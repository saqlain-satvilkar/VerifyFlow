
# VerifyFlow
### Document Verification Workflow Management System

VerifyFlow is a prototype document verification workflow management system inspired by Primary Source Verification (PSV) processes.

It helps manage applicants, verification cases, document records, basic data-quality checks, reviewer notes, and verification status updates through a centralised interface.

**Note:** This is an independent portfolio project. It simulates document verification workflows and performs rule-based data checks. It does not authenticate documents with universities, employers, licensing authorities, or other external organisations.

---

## Features

- **Applicant Management:** Register and maintain applicant records.
- **Case Management:** Create, search, and filter verification cases.
- **Document Management:** Record educational and other verification documents.
- **Data Validation:** Identify missing information, duplicate document numbers, and invalid or inconsistent dates.
- **Workflow Tracking:** Manage cases through Pending, In Review, Verified, and Rejected statuses.
- **Reviewer Notes:** Record comments and review observations against cases.
- **Audit History:** Maintain a record of important case activities and status changes.
- **Dashboard:** View case statistics and recent verification activity.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Python, Streamlit |
| Backend | Node.js, Express.js |
| Database | SQLite |
| Database Library | better-sqlite3 |
| API Communication | REST API, JSON |
| HTTP Requests | Python Requests |
| Version Control | Git, GitHub |

## System Architecture

The application follows a simple three-layer architecture:

1. **Frontend:** Streamlit provides the user interface.
2. **Backend:** Express.js handles API requests, business logic, and validation.
3. **Database:** SQLite stores applicants, cases, documents, reviewer notes, and audit records.

The frontend communicates with the backend through HTTP requests using JSON.

## Project Structure

```text
VerifyFlow/
│
├── backend/
│   ├── database.js
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── app.py
│   └── requirements.txt
│
├── sample_data/
│   └── README.md
│
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following:

- Node.js and npm
- Python 3
- Git

### 1. Clone the repository

```bash
git clone https://github.com/saqlain-satvilkar/VerifyFlow.git
cd VerifyFlow
```

### 2. Set up the backend

```bash
cd backend
npm install
node database.js
node server.js
```

The backend API runs at:

`http://localhost:5000`

Health check:

`http://localhost:5000/api/health`

Keep this terminal running.

### 3. Set up the frontend

Open a second terminal from the project root:

```bash
cd frontend
python -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Start Streamlit:

```bash
python -m streamlit run app.py
```

The frontend will be available at:

`http://localhost:8501`

## Validation Logic

VerifyFlow performs basic rule-based checks on document records, including:

- Missing document information.
- Duplicate document numbers.
- Invalid date formats.
- Expiry dates earlier than issue dates.

Documents that pass the programmed checks are marked Valid. Documents with detected issues are marked Flagged.

A case can only be marked Verified when it contains at least one document and all associated documents have passed validation.

## Current Limitations

- No direct integration with external institutions or verification authorities.
- No automated email or SMS notifications.
- No user authentication or role-based access control.
- No actual document authenticity verification.
- Designed as a local portfolio prototype, not a production deployment.

## Purpose

This project was developed as a practical exercise in software development, REST API integration, database management, workflow automation, and basic data validation.

---

**Developed by Saqlain Satvilkar**

GitHub: https://github.com/saqlain-satvilkar
