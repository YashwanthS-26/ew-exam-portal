# Enlight Wisdom Exam Portal - Complete User Manual

Welcome to the Enlight Wisdom Exam Portal! This system is divided into two parts: the **Admin Dashboard** (for Teachers/Invigilators) and the **Student App** (for Students).

---

## 👨‍🏫 Part 1: For Teachers & Invigilators

The Admin Dashboard allows you to create exams, monitor students in real-time, and view automatically graded results. It is accessed entirely through your web browser.

### 1. Accessing the Dashboard
- Open your browser and go to your live Vercel Admin Dashboard link (e.g., `https://enlight-wisdom-admin.vercel.app`).
- Log in using your admin credentials.

### 2. Creating a New Exam
- Click on **Create Exam** in the sidebar.
- **Details:** Give your exam a Title, a specific Duration (in minutes), and a unique **Exam Code** (e.g., `MATH101`). Students will need this exact code to join.
- **Questions:** Use the Question Builder to add Multiple Choice Questions. Mark the correct option so the system can auto-grade the test later.

### 3. Managing & Publishing Exams
- Go to the **Exams** tab to see all your created tests.
- **Important:** Newly created exams are in "DRAFT" mode. You must click the **Publish** button to make the exam live. If it is not published, students cannot join!

### 4. Live Monitoring (During the Exam)
- Click the **Live Monitoring (Eye Icon)** next to a published exam.
- **Real-Time Tracking:** As students log in, they will instantly appear on your screen. You will see their live status (`JOINED`, `IN_PROGRESS`, `SUBMITTED`).
- **Disconnections:** If a student turns off their computer or loses internet, their status will change to `DISCONNECTED`.
- **Granting Re-attempts:** By default, students can only take an exam once. If a student gets disconnected due to a power failure and you want to let them back in, click the **Refresh/Restart icon** next to their name to wipe their previous attempt and allow them to re-join using the same Register Number.

### 5. Viewing Results
- Once students submit, go to the **Results** tab.
- The system automatically calculates their total score based on the correct answers you provided.

---

## 📤 Part 2: How to Share the App with Students

You do not need to send the students any code. You only need to send them the final Windows Installer file.

1. **Find the Installer:** On your computer, open your project folder and navigate to `apps/student-client/dist-app`.
2. **The File:** Look for the file named **`student-client Setup 0.0.0.exe`**.
3. **Upload:** Drag and drop this `.exe` file into your Google Drive, OneDrive, or Dropbox.
4. **Get the Link:** Right-click the uploaded file, select "Share", and ensure the permissions are set to *"Anyone with the link can view/download"*.
5. **Send:** Send this link to your students via WhatsApp, email, or your student portal, along with their specific **Exam Code**.

---

## 🎓 Part 3: For Students (Student Guide)

You can copy and paste these exact instructions to your students when you send them the download link.

### How to Take Your Exam

**1. Download the App**
Click the link provided by your teacher and download the `.exe` file to your Windows laptop.

**2. Install and Open**
Double-click the downloaded file. It will install instantly. 
*(Note: If Windows shows a blue "Windows protected your PC" popup, click **"More info"** and then **"Run anyway"**).*

**3. Security Scan**
When the app opens, it will automatically scan your system for unauthorized background applications (like Discord, WhatsApp, Chrome, VS Code, AnyDesk, etc.). 
- If you have any of these running, the app will show a red **✗** next to the specific app you need to close. 
- You must close all forbidden apps and click **Re-scan** until you get all green ticks.

**4. Entering the Exam**
- Once the security check passes, enter the **Exam Code** provided by your teacher.
- On the next screen, enter your **Full Name**, **Register Number** (alphanumeric only), and **Department**.
- Click **Start Exam**.

**5. During the Exam (Lockdown Mode)**
- The app will enter strict Full-Screen Lockdown Mode.
- Your taskbar will be hidden, and you will not be able to use the Windows key, Alt-Tab, or open other applications.
- **Do not turn off your computer.** If your computer shuts down or loses internet, your exam will be automatically submitted as-is, and you will need special permission from your teacher to re-enter.

**6. Finishing Up**
Once you have answered all questions, click the **Submit Exam** button. The system will securely save your answers, exit lockdown mode, and safely return your computer to normal.
