## 📋 **Project Summary**

**Ami-Bridge-Live** is a comprehensive **placement preparation and interview practice platform** designed to bridge the gap between campus and corporate. It's built with a **full-stack web application** combining a **Node.js/Express backend** with **HTML5 + JavaScript frontend**, deployed on Vercel.

**Main Purpose:** Enable students to prepare for placements through resume optimization, interview practice, mentorship, and company-based interview simulations.

**Tech Stack:**

- **Backend:** Node.js, Express, PostgreSQL (Neon Serverless DB)
- **Frontend:** HTML5, Tailwind CSS, Chart.js, Vanilla JavaScript
- **AI Integration:** Google Gemini API, Groq SDK for intelligent analysis
- **Deployment:** Vercel (Serverless)
- **Language Composition:** 86.2% HTML, 13.8% JavaScript

---

## 🎯 **Core Features & Functionality**

### **1. User Roles & Authentication**

The platform supports **three distinct user roles**:

- **Students** – Job seekers preparing for placements
- **Mentors** – Industry professionals providing guidance
- **Admins** – Platform administrators managing users and assignments

**Authentication Features:**

- JWT-based token authentication
- Bcryptjs password hashing
- Role-based access control
- Bulk CSV registration for students

---

### **2. Resume Management System**

**Student Features:**

- **Upload Resumes** – PDF/Document upload with validation
- **Resume Storage** – Multiple resume versions can be stored
- **View Resumes** – Download and preview stored resumes
- **AI Analysis** – Automatic resume parsing and content analysis
- **Delete Resumes** – Remove outdated versions

**AI-Powered Capabilities:**

- **Resume Validation** – Uses Google Gemini API to confirm uploaded documents are actual resumes
- **OCR Processing** – Extracts text from scanned PDFs using Gemini vision capabilities
- **Resume Scoring** – Analyzes resume quality, structure, and content
- **AI Feedback** – Provides personalized improvement suggestions
- **Background Job Processing** – Automatic analysis job runs every 5 minutes for pending resumes

**Mentor Features:**

- View all assigned students' resumes
- Get AI-powered suggestions for mentoring focus areas
- Access OCR-extracted resume data
- Provide targeted guidance based on resume analysis

**Admin Features:**

- View aggregated resume data across all students
- Access OCR information for all resumes
- Monitor platform-wide resume quality metrics

---

### **3. Interview Preparation Module**

**Core Functionality:**

- **Company-Based Questions** – Database of interview questions from major companies
- **Attempt Tracking** – Record and store interview practice attempts
- **Score Management** – Track total scores and max possible scores
- **Feedback System** – Mentors provide interview-specific feedback
- **Progress Analytics** – Students can track their interview performance over time

**Student Capabilities:**

- Access company-specific interview questions
- Practice and submit interview attempts
- View scores and performance metrics
- Receive mentor feedback
- Track interview history and progress

**Mentor Capabilities:**

- View assigned students
- Provide detailed feedback on interview attempts
- Give general or category-specific feedback (e.g., communication, technical)
- Track student progress

---

### **4. Internship Database**

**Features:**

- Browse available internship opportunities
- Filter by company, field, and requirements
- Track internship status (applied, selected, in-progress)
- View internship details and eligibility criteria
- Mark internship opportunities as completed

---

### **5. Company Management**

**Admin & Mentor Features:**

- Create and manage company profiles
- Upload interview questions for each company
- Track interview statistics

**Student Features:**

- Browse companies
- View associated interview questions
- Practice company-specific interviews

---

### **6. Bulk User Registration**

**Admin Feature:**

- Upload CSV file with user data (name, email, password, optional mentor assignment)
- Automatic account creation
- Mentor-student assignment during bulk import
- Error handling and duplicate detection

**CSV Format:**

```
name,email,password,mentor_email
John Doe,john@example.com,password123,mentor@example.com
Jane Smith,jane@example.com,pass456,
```

---

## 🖥️ **User Interface & Dashboards**

### **Landing Page (index.html)**

- **Modern, animated landing page** with gradient mesh backgrounds
- Smooth scroll animations and reveal effects
- Navigation menu with smooth transitions
- Hero section with compelling calls-to-action
- Feature showcase section
- Role cards for Students, Mentors, and Admins
- Impact statistics section
- "How it Works" timeline
- Testimonial carousel
- Clean authentication modals (Sign Up/Login)

**UI Design Highlights:**

- Custom Tailwind CSS with extended configuration
- Animated gradient text and blobs
- Marquee animations
- Scroll-reveal animations with staggered delays
- Responsive design with mobile support

### **Student Dashboard (student_dashboard.html)**

- **Dark-themed professional dashboard**
- Sidebar navigation with active state indicators
- Sticky header with user profile chip
- Welcome banner with personalized greeting
- Statistics cards showing:
  - Total interviews attempted
  - Resume score
  - Interview feedback count
  - Active internship applications

**Key Sections:**

1. **Resume Management**
   - Upload new resumes
   - View resume list with status badges
   - AI score display
   - Quick actions (view, delete, analyze)

2. **Interview Practice**
   - Company selection
   - Question display interface
   - Attempt history table
   - Score visualization with charts
   - Feedback display

3. **Internship Tracker**
   - Browse available internships
   - Track application status
   - Paid vs. Unpaid internship badges
   - Duration and requirements display

4. **Performance Analytics**
   - Chart.js powered score charts
   - Progress timeline
   - Feedback history

### **Mentor Dashboard (mentor_dashboard.html)**

- Similar dark theme to student dashboard
- Assigned students list
- Resume review interface
- Student performance tracking
- Feedback submission forms
- OCR resume data display
- Interview question management

### **Admin Dashboard (admin_dashboard.html)**

- Comprehensive platform management
- User management table (students, mentors)
- Assignment management (mentor-student pairs)
- Bulk CSV import functionality
- Platform statistics and analytics
- User creation/deletion controls
- Assignment creation/deletion

---

## 🔌 **Backend Architecture**

### **Project Structure:**

```
src/
├── config/
│   ├── env.js (Environment variables)
│   ├── db.js (PostgreSQL connection)
│   └── ai.js (AI service configuration)
├── controllers/
│   ├── auth.controller.js (Login, signup, JWT)
│   ├── resume.controller.js (Resume CRUD + AI)
│   ├── interview.controller.js (Questions, feedback, assignments)
│   ├── company.controller.js (Company management)
│   └── internship.controller.js (Internship tracking)
├── routes/
│   ├── auth.routes.js
│   ├── resume.routes.js
│   ├── interview.routes.js
│   ├── company.routes.js
│   └── internship.routes.js
├── middlewares/
│   ├── auth.middleware.js (JWT verification)
│   ├── error.middleware.js (Error handling)
│   ├── upload.middleware.js (File upload config)
│   └── rateLimit.middleware.js (API rate limiting)
├── services/
│   ├── resume.service.js (Resume logic)
│   ├── company.service.js (Company logic)
│   └── interview.service.js (Interview logic)
├── models/
│   ├── user.model.js (User queries)
│   ├── resume.model.js (Resume queries)
│   └── interview.model.js (Interview queries)
├── jobs/
│   └── resumeAnalysis.job.js (Background job for AI analysis)
├── utils/
│   ├── response.js (Standardized API responses)
│   └── logger.js (Logging utility)
└── validators/
    └── (Input validation schemas)
```

### **Key Technologies:**

| Dependency                 | Purpose                       |
| -------------------------- | ----------------------------- |
| `express`                  | Web framework                 |
| `pg`                       | PostgreSQL client             |
| `@neondatabase/serverless` | Serverless DB connection      |
| `@google/generative-ai`    | Gemini AI for resume analysis |
| `groq-sdk`                 | Groq API for text analysis    |
| `bcryptjs`                 | Password hashing              |
| `jsonwebtoken`             | JWT authentication            |
| `multer`                   | File upload handling          |
| `pdf-parse`                | PDF text extraction           |
| `csv-parse`                | CSV parsing                   |
| `cors`                     | CORS handling                 |
| `dotenv`                   | Environment variables         |

---

## 🔐 **API Endpoints Structure**

### **Authentication Routes** (`/api/auth`)

- `POST /login` – User login
- `POST /signup` – User registration
- `POST /refresh` – Refresh JWT token

### **Resume Routes** (`/api/`)

- `POST /student/:id/resumes` – Upload resume (with rate limit: 5/min)
- `GET /student/:id/resumes` – List student resumes
- `GET /resume/:resumeId/view` – Download resume file
- `DELETE /resume/:resumeId` – Delete resume
- `POST /resume/:resumeId/analyze` – Trigger AI analysis (10/min limit)
- `GET /resume/:resumeId/ai-feedback` – Get AI suggestions
- `POST /resume/:resumeId/mentor-ai-suggest` – Get mentor AI suggestions (20/min)
- `GET /mentor/:id/resumes-ocr` – Mentor OCR data
- `GET /admin/resumes-ocr` – Admin OCR data

### **Interview Routes** (`/api/`)

- `GET /questions/:companyId` – Get company questions
- `POST /attempts` – Save interview attempt
- `GET /attempts/:studentId` – Get student attempts
- `GET /feedback/:studentId` – Get feedback for student
- `POST /feedback` – Save mentor feedback
- `GET /assigned-students/:mentorId` – Get mentor's students
- `GET /admin/users` – All users (admin)
- `GET /admin/assignments` – All assignments (admin)
- `POST /admin/assignments` – Create assignment (admin)
- `DELETE /admin/assignments/:id` – Delete assignment (admin)
- `POST /admin/bulk-register` – CSV bulk import (admin)

---

## 🎨 **UI/UX Design Details**

### **Design System:**

- **Color Palette:**
  - Primary: #2563EB (Indigo)
  - Accent: #0EA5E9 (Sky)
  - Success: #22C55E (Green)
  - Danger: #EF4444 (Red)
  - Background: #F1F5F9 (Light slate)
  - Dark Background: #020817 (Almost black)

- **Typography:**
  - Display: Space Grotesk (modern, geometric)
  - Body: Inter (clean, readable)
  - Weights: 300, 400, 500, 600, 700, 800, 900

- **Components:**
  - Stat cards with gradient accents
  - Feature cards with hover effects
  - Tables with subtle animations
  - Modal dialogs with backdrop blur
  - Toast notifications
  - Badge system (blue, green, red, amber)
  - Buttons (primary with gradient, secondary)

### **Animations:**

- Fade-in staggered animations (0.04s delays)
- Shimmer loading effect
- Ping animation for notifications
- Hover transform effects (translateY)
- Smooth scroll behavior
- Gradient animation shifts

### **Accessibility:**

- Semantic HTML structure
- ARIA labels in forms
- Keyboard navigation support
- Focus states on inputs
- Sufficient color contrast ratios

---

## 💼 **Workflow Examples**

### **Student Journey:**

1. Sign up on landing page
2. Access student dashboard
3. Upload resume (PDF/DOC)
4. Receive AI analysis and score
5. View improvement suggestions
6. Browse companies and interview questions
7. Practice interviews
8. Submit attempts and get mentor feedback
9. Track progress in analytics

### **Mentor Journey:**

1. Admin assigns students to mentor
2. View assigned students' profiles
3. Review their resumes with OCR data
4. See their interview attempts
5. Provide AI-powered suggestions
6. Send specific feedback
7. Track mentee progress

### **Admin Workflow:**

1. Bulk import students via CSV
2. Assign students to mentors
3. Create company profiles
4. Upload interview questions
5. Monitor platform statistics
6. Manage user accounts
7. Review platform-wide metrics

---

## 🚀 **Key Technical Features**

1. **Background Job Processing** – Resume analysis runs automatically every 5 minutes
2. **Rate Limiting** – API endpoints protected with customizable rate limits
3. **Error Handling** – Centralized error middleware with specific error codes
4. **Input Validation** – CSV and file format validation
5. **AI Integration** – Dual AI service (Gemini for vision, Groq for text)
6. **JWT Security** – Secure token-based authentication
7. **Database Migrations** – Auto-run on server startup
8. **Serverless Ready** – Optimized for Vercel deployment
9. **CORS Enabled** – Cross-origin request support
10. **Response Standardization** – Consistent API response format

---

## 📦 **Deployment**

- **Platform:** Vercel (Serverless)
- **Configuration:** vercel.json set up for Node.js runtime
- **Database:** Neon PostgreSQL (Serverless)
- **Environment Variables Required:**
  - `DATABASE_URL` (PostgreSQL connection string)
  - `GEMINI_API_KEY` (Google AI for resume analysis)
  - `GROQ_API_KEY` (Groq for text analysis)
  - `JWT_SECRET` (Token signing key)
  - `NODE_ENV` (production/development)
  - `PORT` (Optional, defaults to 5000)

---

## ✨ **Standout Features**

1. **AI-Powered Resume Analysis** – Validates actual resumes vs. random documents
2. **OCR Extraction** – Automatically extracts text from scanned PDFs
3. **Background Processing** – Asynchronous resume analysis without blocking requests
4. **Multi-role Platform** – Completely different interfaces for each user type
5. **Modern UI/UX** – Professional dark dashboard with smooth animations
6. **Scalable Architecture** – Modular controllers, services, and models
7. **Comprehensive Feedback Loop** – Multiple touchpoints for mentorship
8. **Bulk Operations** – Efficient CSV-based user import
