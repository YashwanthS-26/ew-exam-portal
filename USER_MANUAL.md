# EW SHIKEN - Complete Teacher & Invigilator Guide

Welcome to **EW SHIKEN**! This platform is designed to make creating, monitoring, and evaluating digital examinations as seamless and secure as possible.

This guide will walk you through how to use the Admin Dashboard, and how to successfully distribute the secure examination app to your students.

---

## 👨‍🏫 Part 1: Using the Admin Dashboard

The Admin Dashboard is your command center. From here you can create exams, track live student progress, and view automated results.

### 1. Accessing the Dashboard
- Open your web browser and navigate to your Vercel Admin Dashboard link.
- Log in using your secure admin credentials.

### 2. Creating a New Exam
- Click on the **Create Exam** button on the dashboard.
- **Configure Details:** Enter the Exam Title, the exact Duration (in minutes), and a unique **Exam Code** (e.g., `MATH101`). Your students will need this exact code to join the test.
- **Add Questions:** Use the interface to add multiple-choice questions. Ensure you select the correct option for each question so the system can automatically grade the test.

### 3. Making the Exam Live
- Newly created exams are saved in **DRAFT** mode by default.
- Go to the **All Exams** tab.
- Click the **Publish** button next to your exam to make it accessible. 
**IMPORTANT:** Students cannot join an exam while it is in DRAFT mode. You must Publish it before the test begins.
- Once Published, you can click **Start** to shift the exam into **ACTIVE** mode, allowing you to enter the Live Monitoring dashboard.

### 4. Live Monitoring 
- Click the **Live** button next to an Active exam.
- **Real-Time Tracking:** As students log in via their desktop app, their names and roll numbers will instantly appear on your screen. You will see their live status (`JOINED`, `IN_PROGRESS`, `SUBMITTED`).
- **Disconnections:** If a student turns off their computer or loses internet connection, their status will immediately change to `DISCONNECTED`.
- **Granting Re-attempts:** By default, students can only submit the exam once. If a student experiences a critical failure (like a power outage) and you wish to allow them back in, click the **Reset/Restart icon** next to their name. This clears their previous partial attempt and allows them to log back in using the same Roll Number.

### 5. Viewing Results
- Once students have submitted their exams, navigate to the **Results** tab.
- The system will automatically calculate their total score based on the answer key you provided during question creation.

---

## 📤 Part 2: Distributing the App to Students

You do not need to deal with code or complex setups to get the students on board. You only need to provide them with the final Windows Installer.

### Step-by-Step Distribution
1. **Locate the Installer:** On your main computer, open your project folder and navigate to `apps/student-client/dist-app`.
2. **Find the File:** Look for the executable file named **`EW SHIKEN Setup 0.0.0.exe`**.
3. **Upload to Cloud:** Drag and drop this `.exe` file into your Google Drive, OneDrive, or Dropbox.
4. **Get the Share Link:** Right-click the uploaded file in your cloud storage, select "Share", and ensure the permissions are set to *"Anyone with the link can view/download"*.
5. **Send to Students:** Distribute this download link to your students (via WhatsApp, email, or a student portal) along with their specific **Exam Code**.

---

## 🎓 Part 3: Instructions to Send to Students

*You can copy and paste the following exact instructions to your students when you send them the download link:*

### How to Take Your EW SHIKEN Exam

**1. Download the App**
Click the link provided by your teacher and download the `EW SHIKEN Setup 0.0.0.exe` file to your Windows laptop.

**2. Install and Open**
Double-click the downloaded file. It will install instantly. 
*(Note: If Windows shows a blue "Windows protected your PC" popup, click **"More info"** and then **"Run anyway"**).*

**3. Pass the Security Scan**
When the app opens, it will automatically scan your system for unauthorized background applications (like Discord, WhatsApp, Chrome, AnyDesk, etc.). 
- If you have any forbidden apps running, the system will show a red **✗** next to them. 
- You must close all restricted applications and click **Re-scan** until you receive all green ticks.

**4. Entering the Exam**
- Once the security check passes, enter the **Exam Code** provided by your teacher.
- On the next screen, enter your **Full Name**, **Register Number** (alphanumeric only), and **Department**.
- Click **Start Exam**.

**5. During the Exam (Lockdown Mode)**
- The app will immediately enter strict Full-Screen Lockdown Mode.
- Your taskbar will be hidden, and you will not be able to use the Windows key, Alt-Tab, or open other applications.
- **Do not turn off your computer.** If your computer shuts down or loses internet, your exam will be automatically submitted as-is, and you will need special permission from your teacher to re-enter.

**6. Finishing Up**
Once you have answered all questions, click the **Submit Exam** button. The system will securely save your answers, exit lockdown mode, and safely return your computer back to normal.
