
/*
 * VerifyFlow - Database Configuration
 *
 * This file is responsible for:
 * 1. Creating and connecting to the SQLite database.
 * 2. Creating all required database tables.
 * 3. Defining relationships between applicants, cases and documents.
 * 4. Inserting fictional sample records for demonstration.
 */

const Database = require("better-sqlite3");
const path = require("path");

// ---------------------------------------------------------
// 1. DATABASE CONNECTION
// ---------------------------------------------------------

// Store the database in the same folder as this JavaScript file.
// This ensures the database location does not depend on where
// the terminal command is executed.
const databasePath = path.join(__dirname, "verifyflow.db");

// Open the database. If the file does not exist, SQLite creates it.
const db = new Database(databasePath);

// Enable foreign key enforcement so related records stay consistent.
db.pragma("foreign_keys = ON");

// Use WAL mode to improve database reliability when reading and writing.
db.pragma("journal_mode = WAL");


// ---------------------------------------------------------
// 2. DATABASE TABLE CREATION
// ---------------------------------------------------------

// Create all tables if they do not already exist.
// IF NOT EXISTS prevents existing data from being overwritten.

db.exec(`

    -- Stores the basic details of each applicant.
    CREATE TABLE IF NOT EXISTS applicants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );


    -- Stores verification requests submitted by applicants.
    -- Each case belongs to one applicant.
    CREATE TABLE IF NOT EXISTS verification_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_reference TEXT NOT NULL UNIQUE,
        applicant_id INTEGER NOT NULL,
        verification_type TEXT NOT NULL,
        institution_name TEXT,
        status TEXT NOT NULL DEFAULT 'Pending'
            CHECK (status IN ('Pending', 'In Review', 'Verified', 'Rejected')),
        priority TEXT NOT NULL DEFAULT 'Normal'
            CHECK (priority IN ('Low', 'Normal', 'High')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (applicant_id)
            REFERENCES applicants(id)
            ON DELETE RESTRICT
    );


    -- Stores documents submitted for each verification case.
    -- One case can contain multiple documents.
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        document_number TEXT,
        issuing_authority TEXT,
        issue_date TEXT,
        expiry_date TEXT,
        validation_status TEXT NOT NULL DEFAULT 'Pending'
            CHECK (validation_status IN ('Pending', 'Valid', 'Flagged')),
        validation_issues TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (case_id)
            REFERENCES verification_cases(id)
            ON DELETE CASCADE
    );


    -- Stores reviewer comments against verification cases.
    CREATE TABLE IF NOT EXISTS review_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        reviewer_name TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (case_id)
            REFERENCES verification_cases(id)
            ON DELETE CASCADE
    );


    -- Records important actions performed on verification cases.
    -- This provides a basic audit trail of case activity.
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        performed_by TEXT DEFAULT 'System',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (case_id)
            REFERENCES verification_cases(id)
            ON DELETE CASCADE
    );


    -- Indexes improve search and filtering performance.
    CREATE INDEX IF NOT EXISTS idx_cases_status
        ON verification_cases(status);

    CREATE INDEX IF NOT EXISTS idx_cases_applicant
        ON verification_cases(applicant_id);

    CREATE INDEX IF NOT EXISTS idx_documents_case
        ON documents(case_id);

    CREATE INDEX IF NOT EXISTS idx_audit_case
        ON audit_logs(case_id);

`);


// ---------------------------------------------------------
// 3. SAMPLE DATA
// ---------------------------------------------------------

// Insert fictional demonstration records only when the database
// is empty. Restarting the application will not duplicate them.

const applicantCount = db
    .prepare("SELECT COUNT(*) AS total FROM applicants")
    .get().total;

if (applicantCount === 0) {

    // A database transaction ensures all sample records are inserted
    // together. If one operation fails, the transaction is rolled back.
    const insertSampleData = db.transaction(() => {

        // Create a fictional applicant.
        const applicantResult = db.prepare(`
            INSERT INTO applicants (full_name, email, phone)
            VALUES (?, ?, ?)
        `).run(
            "Ahmed Rahman",
            "ahmed.demo@example.com",
            "+971500000001"
        );

        const applicantId = applicantResult.lastInsertRowid;

        // Create a verification case for the applicant.
        const caseResult = db.prepare(`
            INSERT INTO verification_cases (
                case_reference,
                applicant_id,
                verification_type,
                institution_name,
                status,
                priority
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            "VF-2026-0001",
            applicantId,
            "Educational Qualification",
            "Example International University",
            "In Review",
            "Normal"
        );

        const caseId = caseResult.lastInsertRowid;

        // Add a fictional educational document.
        db.prepare(`
            INSERT INTO documents (
                case_id,
                document_type,
                document_number,
                issuing_authority,
                issue_date,
                validation_status,
                validation_issues
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            caseId,
            "Degree Certificate",
            "DEMO-2026-001",
            "Example International University",
            "2024-06-15",
            "Valid",
            "[]"
        );

        // Add an initial reviewer note.
        db.prepare(`
            INSERT INTO review_notes (
                case_id,
                reviewer_name,
                note
            )
            VALUES (?, ?, ?)
        `).run(
            caseId,
            "Demo Reviewer",
            "Application received. Document details are ready for review."
        );

        // Record the creation of the case in the audit history.
        db.prepare(`
            INSERT INTO audit_logs (
                case_id,
                action,
                details,
                performed_by
            )
            VALUES (?, ?, ?, ?)
        `).run(
            caseId,
            "CASE_CREATED",
            "Sample verification case created.",
            "System"
        );

    });

    // Execute the sample data insertion transaction.
    insertSampleData();

    console.log("VerifyFlow: Sample records inserted successfully.");
}


// ---------------------------------------------------------
// 4. EXPORT DATABASE CONNECTION
// ---------------------------------------------------------

// Export the database connection so server.js can use it
// to execute queries and manage application records.

module.exports = db;

console.log("VerifyFlow: Database connected and tables are ready.");
