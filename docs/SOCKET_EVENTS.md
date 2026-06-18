# EW Exam Portal - Socket.IO Events Documentation

## Client to Server Events

### `join_exam`
- **Sender**: Student Client
- **Payload**: `{ examCode: string, attemptId: string, name: string, rollNumber: string }`
- **Purpose**: Join the socket room for the specific exam and link socket ID to attempt.

### `save_answer`
- **Sender**: Student Client
- **Payload**: `{ attemptId: string, questionId: string, selectedOption: "A" | "B" | "C" | "D" | null }`
- **Purpose**: Autosave answer to the backend. Server replies with `autosave` event on success.

### `submit_exam`
- **Sender**: Student Client
- **Payload**: `{ attemptId: string }`
- **Purpose**: Student explicitly submits the exam. Evaluates score and ends session.

### `admin_join`
- **Sender**: Admin Portal
- **Payload**: `None`
- **Purpose**: Admin joins `admin_room` to receive global updates (connections, disconnects).

### `heartbeat`
- **Sender**: Any Client
- **Payload**: `None`
- **Purpose**: Check connection health. Server responds with `heartbeat_ack`.

---

## Server to Client Events

### `student_connected`
- **Recipient**: `admin_room` (Admin Portal)
- **Payload**: `{ socketId: string, examCode: string, attemptId: string, name: string, rollNumber: string }`
- **Purpose**: Real-time update to live monitor table.

### `student_disconnected`
- **Recipient**: `admin_room` (Admin Portal)
- **Payload**: `{ socketId: string, attemptId: string }`
- **Purpose**: Update live monitor status to 'DISCONNECTED'.

### `autosave`
- **Recipient**: Specific Student Socket
- **Payload**: `{ status: 'success', questionId: string }`
- **Purpose**: Confirm answer was saved in DB.

### `force_submit`
- **Recipient**: Specific Student Socket
- **Payload**: `None`
- **Purpose**: Force the student client to transition to the Submitted screen.

### `end_student`
- **Recipient**: Specific Student Socket
- **Payload**: `None`
- **Purpose**: Force the student client to close the exam (violation/cheating).

### `restart_student`
- **Recipient**: Specific Student Socket
- **Payload**: `None`
- **Purpose**: Restart the student's exam attempt from scratch.

### `announcement`
- **Recipient**: Exam Room (All Students in an exam)
- **Payload**: `string` (Message)
- **Purpose**: Broadcast a message from the admin to all test takers.
