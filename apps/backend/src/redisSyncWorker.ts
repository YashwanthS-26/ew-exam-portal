import { redisClient } from './redisClient';
import { supabase } from './server';

// Flush all pending answers for one attempt from Redis → Supabase immediately
export const flushAttemptToSupabase = async (attemptId: string): Promise<void> => {
    if (!redisClient.isOpen) return;
    const hashKey = `sync_queue:${attemptId}`;
    const answersDict = await redisClient.hGetAll(hashKey);
    if (!answersDict || Object.keys(answersDict).length === 0) return;

    const upsertPayload = Object.entries(answersDict).map(([questionId, selectedOption]) => ({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption === 'null' ? null : selectedOption,
        saved_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('student_answers').upsert(upsertPayload, { onConflict: 'attempt_id, question_id' });
    if (error) {
        console.error(`[SYNC WORKER] On-demand flush failed for attempt ${attemptId}:`, error);
    } else {
        const fields = Object.keys(answersDict);
        if (fields.length > 0) await redisClient.hDel(hashKey, fields);
        await redisClient.sRem('active_sync_attempts', attemptId);
        console.log(`[SYNC WORKER] On-demand flushed ${fields.length} answers for attempt ${attemptId}`);
    }
};

export const startRedisSyncWorker = () => {
    console.log('Starting Redis -> Supabase Sync Worker...');
    
    setInterval(async () => {
        try {
            if (!redisClient.isOpen) return;
            const attempts = await redisClient.sMembers('active_sync_attempts');
            if (!attempts || attempts.length === 0) return;

            for (const attemptId of attempts) {
                await flushAttemptToSupabase(attemptId);
            }
        } catch (err) {
            console.error('[SYNC WORKER] Critical Error in flush loop:', err);
        }
    }, 5000);
};
