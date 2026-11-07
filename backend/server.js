
/*
 * ============================================================
 * VERIFYFLOW - BACKEND REST API
 * ============================================================
 *
 * Technology:
 * - Node.js: JavaScript runtime
 * - Express: REST API framework
 * - SQLite: Database
 *
 * Responsibilities:
 * 1. Receive requests from the frontend.
 * 2. Validate incoming information.
 * 3. Read and update database records.
 * 4. Manage document verification workflows.
 * 5. Record important actions in the audit history.
 *
 * API BASE URL: http://localhost:5000/api
 */

// ------------------------------------------------------------
// 1. IMPORT REQUIRED PACKAGES
// ------------------------------------------------------------

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

// Import the SQLite database connection created in database.js.
const db = require("./database");


// ------------------------------------------------------------
// 2. INITIALISE EXPRESS APPLICATION
// ------------------------------------------------------------

const app = express();
const PORT = 5000;

// Allow the frontend to communicate with this backend.
app.use(cors());

// Allow the API to receive and understand JSON request bodies.
app.use(express.json());


// ------------------------------------------------------------
// 3. REUSABLE HELPER FUNCTIONS
// ------------------------------------------------------------

// Check whether an ID is a valid positive integer.
function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}


// Check whether an email address has a basic valid format.
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// Generate a unique reference for each verification case.
function generateCaseReference() {
    const year = new Date().getFullYear();
    const uniqueCode = crypto.randomBytes(3).toString("hex").toUpperCase();

    return `VF-${year}-${uniqueCode}`;
}


// Check whether a date is a real calendar date in YYYY-MM-DD format.
function isValidDate(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    return !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date;
}


// Record important actions in the audit_logs table.
// This helps reviewers understand what happened to a case.
function logActivity(caseId, action, details, performedBy = "System") {

    db.prepare(`
        INSERT INTO audit_logs (
            case_id,
            action,
            details,
            performed_by
        )
        VALUES (?, ?, ?, ?)
    `).run(caseId, action, details, performedBy);
}


// Run basic checks on a document's information.
// These checks identify incomplete or inconsistent records.
// They do not authenticate the document with its issuing authority.
function validateDocument(document) {

    const issues = [];

    // Required information checks.
    if (!document.document_type) {
        issues.push("Document type is missing.");
    }

    if (!document.document_number) {
        issues.push("Document number is missing.");
    }

    if (!document.issuing_authority) {
        issues.push("Issuing authority is missing.");
    }

    // Validate issue date if supplied.
    if (document.issue_date && !isValidDate(document.issue_date)) {
        issues.push("Issue date is not a valid YYYY-MM-DD date.");
    }

    // Validate expiry date if supplied.
    if (document.expiry_date && !isValidDate(document.expiry_date)) {
        issues.push("Expiry date is not a valid YYYY-MM-DD date.");
    }

    // Check that the expiry date is not earlier than the issue date.
    if (
        document.issue_date &&
        document.expiry_date &&
        isValidDate(document.issue_date) &&
        isValidDate(document.expiry_date) &&
        document.expiry_date < document.issue_date
    ) {
        issues.push("Expiry date cannot be earlier than issue date.");
    }

    // Check whether the document number already exists.
    if (document.document_number) {

        let duplicateQuery = `
            SELECT id FROM documents
            WHERE LOWER(document_number) = LOWER(?)
        `;

        const parameters = [document.document_number];

        // During revalidation, exclude the current document itself.
        if (document.id) {
            duplicateQuery += " AND id != ?";
            parameters.push(document.id);
        }

        const duplicate = db.prepare(duplicateQuery).get(...parameters);

        if (duplicate) {
            issues.push("This document number already exists in another record.");
        }
    }

    // Return all identified issues and the overall result.
    return {
        status: issues.length === 0 ? "Valid" : "Flagged",
        issues
    };
}


// ------------------------------------------------------------
// 4. HEALTH CHECK ENDPOINT
// ------------------------------------------------------------

// GET /api/health
// Confirms that the backend is running and responding.

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "VerifyFlow API is running.",
        timestamp: new Date().toISOString()
    });

});


// ------------------------------------------------------------
// 5. DASHBOARD STATISTICS
// ------------------------------------------------------------

// GET /api/dashboard
// Returns summary figures for the main dashboard.

app.get("/api/dashboard", (req, res) => {

    try {

        const totalCases = db.prepare(`
            SELECT COUNT(*) AS total FROM verification_cases
        `).get().total;

        const pendingCases = db.prepare(`
            SELECT COUNT(*) AS total
            FROM verification_cases
            WHERE status = 'Pending'
        `).get().total;

        const reviewCases = db.prepare(`
            SELECT COUNT(*) AS total
            FROM verification_cases
            WHERE status = 'In Review'
        `).get().total;

        const verifiedCases = db.prepare(`
            SELECT COUNT(*) AS total
            FROM verification_cases
            WHERE status = 'Verified'
        `).get().total;

        const rejectedCases = db.prepare(`
            SELECT COUNT(*) AS total
            FROM verification_cases
            WHERE status = 'Rejected'
        `).get().total;

        const flaggedDocuments = db.prepare(`
            SELECT COUNT(*) AS total
            FROM documents
            WHERE validation_status = 'Flagged'
        `).get().total;

        res.json({
            success: true,
            statistics: {
                totalCases,
                pendingCases,
                reviewCases,
                verifiedCases,
                rejectedCases,
                flaggedDocuments
            }
        });

    } catch (error) {

        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve dashboard statistics."
        });

    }

});


// ------------------------------------------------------------
// 6. APPLICANT MANAGEMENT
// ------------------------------------------------------------

// GET /api/applicants
// Retrieve all registered applicants.

app.get("/api/applicants", (req, res) => {

    const applicants = db.prepare(`
        SELECT * FROM applicants
        ORDER BY created_at DESC
    `).all();

    res.json({
        success: true,
        count: applicants.length,
        applicants
    });

});


// POST /api/applicants
// Register a new applicant.

app.post("/api/applicants", (req, res) => {

    const { full_name, email, phone } = req.body;

    // Check mandatory applicant information.
    if (!full_name || !email) {
        return res.status(400).json({
            success: false,
            message: "Full name and email are required."
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid email address."
        });
    }

    try {

        const result = db.prepare(`
            INSERT INTO applicants (full_name, email, phone)
            VALUES (?, ?, ?)
        `).run(
            full_name.trim(),
            email.trim().toLowerCase(),
            phone || null
        );

        res.status(201).json({
            success: true,
            message: "Applicant registered successfully.",
            applicantId: result.lastInsertRowid
        });

    } catch (error) {

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "An applicant with this email already exists."
            });
        }

        console.error("Applicant registration error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to register applicant."
        });

    }

});


// ------------------------------------------------------------
// 7. VERIFICATION CASE MANAGEMENT
// ------------------------------------------------------------

// GET /api/cases
// Retrieve all verification cases along with applicant details.
// Optional filters:
// /api/cases?status=Pending
// /api/cases?search=Ahmed

app.get("/api/cases", (req, res) => {

    const { status, search } = req.query;

    let query = `
        SELECT
            vc.*,
            a.full_name,
            a.email,
            a.phone
        FROM verification_cases vc
        JOIN applicants a ON vc.applicant_id = a.id
        WHERE 1 = 1
    `;

    const parameters = [];

    // Apply status filtering when requested.
    if (status) {
        query += " AND vc.status = ?";
        parameters.push(status);
    }

    // Search using case reference or applicant name.
    if (search) {
        query += `
            AND (
                vc.case_reference LIKE ?
                OR a.full_name LIKE ?
                OR a.email LIKE ?
            )
        `;

        const searchValue = `%${search}%`;

        parameters.push(searchValue, searchValue, searchValue);
    }

    query += " ORDER BY vc.created_at DESC";

    const cases = db.prepare(query).all(...parameters);

    res.json({
        success: true,
        count: cases.length,
        cases
    });

});


// GET /api/cases/:id
// Retrieve one case with its applicant, documents and notes.

app.get("/api/cases/:id", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const caseId = Number(req.params.id);

    const verificationCase = db.prepare(`
        SELECT
            vc.*,
            a.full_name,
            a.email,
            a.phone
        FROM verification_cases vc
        JOIN applicants a ON vc.applicant_id = a.id
        WHERE vc.id = ?
    `).get(caseId);

    if (!verificationCase) {
        return res.status(404).json({
            success: false,
            message: "Verification case not found."
        });
    }

    const documents = db.prepare(`
        SELECT * FROM documents
        WHERE case_id = ?
        ORDER BY created_at DESC
    `).all(caseId);

    const notes = db.prepare(`
        SELECT * FROM review_notes
        WHERE case_id = ?
        ORDER BY created_at DESC
    `).all(caseId);

    res.json({
        success: true,
        case: verificationCase,
        documents,
        notes
    });

});


// POST /api/cases
// Create a new verification case for an existing applicant.

app.post("/api/cases", (req, res) => {

    const {
        applicant_id,
        verification_type,
        institution_name,
        priority
    } = req.body;

    if (!applicant_id || !verification_type) {
        return res.status(400).json({
            success: false,
            message: "Applicant ID and verification type are required."
        });
    }

    if (!isValidId(applicant_id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid applicant ID."
        });
    }

    const applicant = db.prepare(`
        SELECT id FROM applicants WHERE id = ?
    `).get(Number(applicant_id));

    if (!applicant) {
        return res.status(404).json({
            success: false,
            message: "Applicant does not exist."
        });
    }

    const allowedPriorities = ["Low", "Normal", "High"];
    const selectedPriority = priority || "Normal";

    if (!allowedPriorities.includes(selectedPriority)) {
        return res.status(400).json({
            success: false,
            message: "Priority must be Low, Normal or High."
        });
    }

    try {

        // Use a transaction so case creation and audit logging
        // either both succeed or both fail.
        const createCase = db.transaction(() => {

            let caseReference;
            let referenceExists;

            // Generate a reference that is not already in use.
            do {
                caseReference = generateCaseReference();

                referenceExists = db.prepare(`
                    SELECT id FROM verification_cases
                    WHERE case_reference = ?
                `).get(caseReference);

            } while (referenceExists);

            const result = db.prepare(`
                INSERT INTO verification_cases (
                    case_reference,
                    applicant_id,
                    verification_type,
                    institution_name,
                    priority
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                caseReference,
                Number(applicant_id),
                verification_type.trim(),
                institution_name || null,
                selectedPriority
            );

            const caseId = result.lastInsertRowid;

            logActivity(
                caseId,
                "CASE_CREATED",
                "New verification case created."
            );

            return {
                caseId,
                caseReference
            };

        });

        const newCase = createCase();

        res.status(201).json({
            success: true,
            message: "Verification case created successfully.",
            ...newCase
        });

    } catch (error) {

        console.error("Case creation error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create verification case."
        });

    }

});


// ------------------------------------------------------------
// 8. DOCUMENT MANAGEMENT
// ------------------------------------------------------------

// POST /api/cases/:id/documents
// Add a document to an existing verification case.

app.post("/api/cases/:id/documents", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const caseId = Number(req.params.id);

    const {
        document_type,
        document_number,
        issuing_authority,
        issue_date,
        expiry_date
    } = req.body;

    const existingCase = db.prepare(`
        SELECT id FROM verification_cases WHERE id = ?
    `).get(caseId);

    if (!existingCase) {
        return res.status(404).json({
            success: false,
            message: "Verification case not found."
        });
    }

    if (!document_type) {
        return res.status(400).json({
            success: false,
            message: "Document type is required."
        });
    }

    // Run validation before saving the document.
    const validation = validateDocument({
        document_type,
        document_number,
        issuing_authority,
        issue_date,
        expiry_date
    });

    try {

        const createDocument = db.transaction(() => {

            const result = db.prepare(`
                INSERT INTO documents (
                    case_id,
                    document_type,
                    document_number,
                    issuing_authority,
                    issue_date,
                    expiry_date,
                    validation_status,
                    validation_issues
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                caseId,
                document_type.trim(),
                document_number || null,
                issuing_authority || null,
                issue_date || null,
                expiry_date || null,
                validation.status,
                JSON.stringify(validation.issues)
            );

            logActivity(
                caseId,
                "DOCUMENT_ADDED",
                `Document added: ${document_type}.`
            );

            return result.lastInsertRowid;

        });

        const documentId = createDocument();

        res.status(201).json({
            success: true,
            message: "Document added successfully.",
            documentId,
            validation
        });

    } catch (error) {

        console.error("Document creation error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to add document."
        });

    }

});


// GET /api/cases/:id/documents
// Retrieve all documents belonging to one case.

app.get("/api/cases/:id/documents", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const documents = db.prepare(`
        SELECT * FROM documents
        WHERE case_id = ?
        ORDER BY created_at DESC
    `).all(Number(req.params.id));

    res.json({
        success: true,
        count: documents.length,
        documents
    });

});


// POST /api/documents/:id/validate
// Recheck an existing document and update its validation result.

app.post("/api/documents/:id/validate", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid document ID."
        });
    }

    const documentId = Number(req.params.id);

    const document = db.prepare(`
        SELECT * FROM documents WHERE id = ?
    `).get(documentId);

    if (!document) {
        return res.status(404).json({
            success: false,
            message: "Document not found."
        });
    }

    const validation = validateDocument(document);

    const updateDocument = db.transaction(() => {

        db.prepare(`
            UPDATE documents
            SET validation_status = ?,
                validation_issues = ?
            WHERE id = ?
        `).run(
            validation.status,
            JSON.stringify(validation.issues),
            documentId
        );

        logActivity(
            document.case_id,
            "DOCUMENT_VALIDATED",
            `Document ${documentId} validation result: ${validation.status}.`
        );

    });

    updateDocument();

    res.json({
        success: true,
        message: "Document validation completed.",
        documentId,
        validation
    });

});


// ------------------------------------------------------------
// 9. CASE STATUS MANAGEMENT
// ------------------------------------------------------------

// PUT /api/cases/:id/status
// Update the workflow status of a verification case.

app.put("/api/cases/:id/status", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const caseId = Number(req.params.id);
    const { status, reviewer_name } = req.body;

    const allowedStatuses = [
        "Pending",
        "In Review",
        "Verified",
        "Rejected"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status. Choose Pending, In Review, Verified or Rejected."
        });
    }

    const existingCase = db.prepare(`
        SELECT id, status FROM verification_cases WHERE id = ?
    `).get(caseId);

    if (!existingCase) {
        return res.status(404).json({
            success: false,
            message: "Verification case not found."
        });
    }

    // A case cannot be marked Verified while it has no documents
    // or while any of its documents are not marked Valid.
    if (status === "Verified") {

        const documentSummary = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE WHEN validation_status != 'Valid'
                    THEN 1 ELSE 0 END
                ) AS invalid
            FROM documents
            WHERE case_id = ?
        `).get(caseId);

        if (
            documentSummary.total === 0 ||
            documentSummary.invalid > 0
        ) {
            return res.status(400).json({
                success: false,
                message: "This case cannot be verified until it has documents and all documents pass validation."
            });
        }

    }

    try {

        const updateCase = db.transaction(() => {

            db.prepare(`
                UPDATE verification_cases
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(status, caseId);

            logActivity(
                caseId,
                "STATUS_UPDATED",
                `Status changed from ${existingCase.status} to ${status}.`,
                reviewer_name || "System"
            );

        });

        updateCase();

        res.json({
            success: true,
            message: "Verification case status updated.",
            previousStatus: existingCase.status,
            currentStatus: status
        });

    } catch (error) {

        console.error("Status update error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update case status."
        });

    }

});


// ------------------------------------------------------------
// 10. REVIEWER NOTES
// ------------------------------------------------------------

// POST /api/cases/:id/notes
// Add a review note to a verification case.

app.post("/api/cases/:id/notes", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const caseId = Number(req.params.id);
    const { reviewer_name, note } = req.body;

    if (!reviewer_name || !note) {
        return res.status(400).json({
            success: false,
            message: "Reviewer name and note are required."
        });
    }

    const existingCase = db.prepare(`
        SELECT id FROM verification_cases WHERE id = ?
    `).get(caseId);

    if (!existingCase) {
        return res.status(404).json({
            success: false,
            message: "Verification case not found."
        });
    }

    const addNote = db.transaction(() => {

        const result = db.prepare(`
            INSERT INTO review_notes (
                case_id,
                reviewer_name,
                note
            )
            VALUES (?, ?, ?)
        `).run(caseId, reviewer_name.trim(), note.trim());

        logActivity(
            caseId,
            "REVIEW_NOTE_ADDED",
            "A reviewer added a note.",
            reviewer_name
        );

        return result.lastInsertRowid;

    });

    const noteId = addNote();

    res.status(201).json({
        success: true,
        message: "Review note added successfully.",
        noteId
    });

});


// ------------------------------------------------------------
// 11. AUDIT HISTORY
// ------------------------------------------------------------

// GET /api/cases/:id/history
// Retrieve all recorded actions for a verification case.

app.get("/api/cases/:id/history", (req, res) => {

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID."
        });
    }

    const caseId = Number(req.params.id);

    const existingCase = db.prepare(`
        SELECT id FROM verification_cases WHERE id = ?
    `).get(caseId);

    if (!existingCase) {
        return res.status(404).json({
            success: false,
            message: "Verification case not found."
        });
    }

    const history = db.prepare(`
        SELECT * FROM audit_logs
        WHERE case_id = ?
        ORDER BY created_at DESC, id DESC
    `).all(caseId);

    res.json({
        success: true,
        count: history.length,
        history
    });

});


// ------------------------------------------------------------
// 12. HANDLE UNKNOWN API ROUTES
// ------------------------------------------------------------

// Return a clear response when a requested endpoint does not exist.

app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });

});


// ------------------------------------------------------------
// 13. GLOBAL ERROR HANDLER
// ------------------------------------------------------------

// Handle malformed JSON and unexpected errors in one place.

app.use((error, req, res, next) => {

    console.error("Unexpected server error:", error);

    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body."
        });
    }

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });

});


// ------------------------------------------------------------
// 14. START THE SERVER
// ------------------------------------------------------------

// Listen for incoming requests on port 5000.
// The API is now available to the frontend and API testing tools.

app.listen(PORT, () => {

    console.log("------------------------------------------");
    console.log("       VERIFYFLOW API SERVER");
    console.log("------------------------------------------");
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`API base URL: http://localhost:${PORT}/api`);
    console.log("Server status: Online");
    console.log("------------------------------------------");

});
