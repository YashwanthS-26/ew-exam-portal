import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface AnswerRecord {
    id: string; // Composite key: attemptId_questionId
    attemptId: string;
    questionId: string;
    selectedOption: string | null;
    status: 'PENDING' | 'SYNCED';
    retryCount: number;
    lastAttempt: number;
    updatedAt: number;
}

interface ExamDB extends DBSchema {
    answers: {
        key: string;
        value: AnswerRecord;
        indexes: {
            'by-status': string;
            'by-attempt': string;
        };
    };
}

let dbPromise: Promise<IDBPDatabase<ExamDB>> | null = null;

export const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ExamDB>('EnlightWisdomDB', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('answers')) {
                    const store = db.createObjectStore('answers', { keyPath: 'id' });
                    store.createIndex('by-status', 'status');
                    store.createIndex('by-attempt', 'attemptId');
                }
            },
        });
    }
    return dbPromise;
};

export const saveAnswerLocal = async (attemptId: string, questionId: string, selectedOption: string | null) => {
    const db = await initDB();
    const id = `${attemptId}_${questionId}`;
    
    const existing = await db.get('answers', id);
    const now = Date.now();

    const record: AnswerRecord = {
        id,
        attemptId,
        questionId,
        selectedOption,
        status: 'PENDING',
        retryCount: existing ? existing.retryCount : 0,
        lastAttempt: existing ? existing.lastAttempt : 0,
        updatedAt: now
    };

    await db.put('answers', record);
};

export const getPendingAnswers = async (attemptId: string): Promise<AnswerRecord[]> => {
    const db = await initDB();
    const tx = db.transaction('answers', 'readonly');
    const index = tx.store.index('by-status');
    const allPending = await index.getAll('PENDING');
    
    return allPending.filter(ans => ans.attemptId === attemptId);
};

export const markAnswersSynced = async (ids: string[]) => {
    const db = await initDB();
    const tx = db.transaction('answers', 'readwrite');
    for (const id of ids) {
        const record = await tx.store.get(id);
        if (record) {
            record.status = 'SYNCED';
            record.updatedAt = Date.now();
            record.retryCount = 0;
            await tx.store.put(record);
        }
    }
    await tx.done;
};

export const markAnswersFailed = async (ids: string[]) => {
    const db = await initDB();
    const tx = db.transaction('answers', 'readwrite');
    for (const id of ids) {
        const record = await tx.store.get(id);
        if (record) {
            record.retryCount += 1;
            record.lastAttempt = Date.now();
            await tx.store.put(record);
        }
    }
    await tx.done;
};

export const getAllAnswersForAttempt = async (attemptId: string): Promise<Record<string, string | null>> => {
    const db = await initDB();
    const index = db.transaction('answers', 'readonly').store.index('by-attempt');
    const records = await index.getAll(attemptId);
    
    const dict: Record<string, string | null> = {};
    for (const r of records) {
        dict[r.questionId] = r.selectedOption;
    }
    return dict;
};
