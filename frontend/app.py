# ============================================================
# VERIFYFLOW
# Document Verification Workflow Management System
#
# Frontend: Streamlit
# Backend: Node.js + Express REST API
# Database: SQLite
#
# This application communicates with the existing backend.
# It does not directly modify the database.
# ============================================================

import streamlit as st
import requests
import json

# ------------------------------------------------------------
# 1. APPLICATION CONFIGURATION
# ------------------------------------------------------------

# Address of the existing Node.js backend.
API_BASE_URL = "http://localhost:5000/api"

# Configure the browser tab and page layout.
st.set_page_config(
    page_title="VerifyFlow | Document Verification",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ------------------------------------------------------------
# 2. CUSTOM CSS
# ------------------------------------------------------------

# These styles give the application a clean dark dashboard
# appearance without changing Streamlit's functionality.

st.markdown("""
<style>
    .stApp {
        background-color: #10141c;
        color: #e5e7eb;
    }

    [data-testid="stSidebar"] {
        background-color: #171d28;
        border-right: 1px solid #293344;
    }

    [data-testid="stMetric"] {
        background-color: #1a2230;
        border: 1px solid #2b3749;
        padding: 18px;
        border-radius: 10px;
    }

    div[data-testid="stForm"] {
        background-color: #171d28;
        border: 1px solid #293344;
        padding: 18px;
        border-radius: 10px;
    }

    .main-title {
        font-size: 30px;
        font-weight: 700;
        color: #f3f4f6;
    }

    .sub-title {
        color: #9ca3af;
        font-size: 14px;
    }

    .section-title {
        font-size: 20px;
        font-weight: 600;
        margin-top: 20px;
        margin-bottom: 12px;
        color: #f3f4f6;
    }

    div.stButton > button {
        border-radius: 7px;
        font-weight: 600;
    }

    hr {
        border-color: #293344;
    }
</style>
""", unsafe_allow_html=True)


# ------------------------------------------------------------
# 3. API COMMUNICATION FUNCTIONS
# ------------------------------------------------------------

# These functions send HTTP requests to the Node.js backend.
# The backend handles validation, business logic and database
# operations. Streamlit only displays the returned information.

def api_get(endpoint, params=None):
    """Retrieve information from a backend GET endpoint."""

    try:
        response = requests.get(
            f"{API_BASE_URL}{endpoint}",
            params=params,
            timeout=10
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.RequestException as error:
        st.error(f"Could not retrieve information from the API: {error}")
        return None


def api_post(endpoint, payload=None):
    """Send new information to a backend POST endpoint."""

    try:
        response = requests.post(
            f"{API_BASE_URL}{endpoint}",
            json=payload or {},
            timeout=10
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError:
        try:
            message = response.json().get("error", response.text)
        except Exception:
            message = response.text

        st.error(f"Request failed: {message}")
        return None

    except requests.exceptions.RequestException as error:
        st.error(f"Could not connect to the API: {error}")
        return None


def api_put(endpoint, payload=None):
    """Update existing information through a backend PUT endpoint."""

    try:
        response = requests.put(
            f"{API_BASE_URL}{endpoint}",
            json=payload or {},
            timeout=10
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError:
        try:
            message = response.json().get("error", response.text)
        except Exception:
            message = response.text

        st.error(f"Update failed: {message}")
        return None

    except requests.exceptions.RequestException as error:
        st.error(f"Could not connect to the API: {error}")
        return None


# ------------------------------------------------------------
# 4. HELPER FUNCTIONS
# ------------------------------------------------------------

def extract_list(data, possible_keys):
    """
    API endpoints may return a list directly or place the list
    inside an object. This function handles both formats.
    """

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        for key in possible_keys:
            if isinstance(data.get(key), list):
                return data[key]

    return []


def show_page_header(title, description):
    """Display a consistent heading on each application page."""

    st.markdown(f'<div class="main-title">{title}</div>',
                unsafe_allow_html=True)

    st.markdown(
        f'<div class="sub-title">{description}</div>',
        unsafe_allow_html=True
    )

    st.divider()


def display_status(status):
    """Display verification status using simple colored labels."""

    colors = {
        "Pending": "orange",
        "In Review": "blue",
        "Verified": "green",
        "Rejected": "red"
    }

    color = colors.get(status, "gray")

    st.markdown(
        f":{color}[**{status}**]"
    )


# ------------------------------------------------------------
# 5. SIDEBAR NAVIGATION
# ------------------------------------------------------------

with st.sidebar:

    st.markdown("## VERIFYFLOW")
    st.caption("Document Verification System")

    st.divider()

    page = st.radio(
        "NAVIGATION",
        [
            "Dashboard",
            "Applicants",
            "Verification Cases",
            "Case Workspace"
        ]
    )

    st.divider()

    st.caption("System Information")
    st.write("Frontend: Streamlit")
    st.write("Backend: Node.js")
    st.write("Database: SQLite")

    if st.button("Refresh Application", use_container_width=True):
        st.rerun()


# ------------------------------------------------------------
# 6. DASHBOARD
# ------------------------------------------------------------

if page == "Dashboard":

    show_page_header(
        "Dashboard",
        "Overview of applicants and document verification activity."
    )

    dashboard_data = api_get("/dashboard")

    cases_data = api_get("/cases")

    cases = extract_list(cases_data, ["cases", "data"])

    if dashboard_data is not None:

        # Use backend dashboard statistics where available.
        # Calculate fallback values from the cases list if needed.

        total_cases = dashboard_data.get(
            "total_cases",
            dashboard_data.get("totalCases", len(cases))
        )

        pending_cases = dashboard_data.get(
            "pending_cases",
            dashboard_data.get(
                "pending",
                sum(1 for c in cases if c.get("status") == "Pending")
            )
        )

        review_cases = dashboard_data.get(
            "in_review_cases",
            dashboard_data.get(
                "in_review",
                sum(1 for c in cases if c.get("status") == "In Review")
            )
        )

        verified_cases = dashboard_data.get(
            "verified_cases",
            dashboard_data.get(
                "verified",
                sum(1 for c in cases if c.get("status") == "Verified")
            )
        )

        rejected_cases = dashboard_data.get(
            "rejected_cases",
            dashboard_data.get(
                "rejected",
                sum(1 for c in cases if c.get("status") == "Rejected")
            )
        )

        flagged_documents = dashboard_data.get(
            "flagged_documents",
            dashboard_data.get("flagged", 0)
        )

        # Display the main dashboard metrics.
        col1, col2, col3 = st.columns(3)

        col1.metric("Total Cases", total_cases)
        col2.metric("Pending", pending_cases)
        col3.metric("In Review", review_cases)

        col4, col5, col6 = st.columns(3)

        col4.metric("Verified", verified_cases)
        col5.metric("Rejected", rejected_cases)
        col6.metric("Flagged Documents", flagged_documents)

        st.markdown(
            '<div class="section-title">Verification Overview</div>',
            unsafe_allow_html=True
        )

        chart_data = {
            "Status": ["Pending", "In Review", "Verified", "Rejected"],
            "Cases": [
                pending_cases,
                review_cases,
                verified_cases,
                rejected_cases
            ]
        }

        st.bar_chart(
            chart_data,
            x="Status",
            y="Cases",
            color="#4388d6"
        )

        st.markdown(
            '<div class="section-title">Recent Verification Cases</div>',
            unsafe_allow_html=True
        )

        if cases:

            recent_cases = cases[:5]

            for case in recent_cases:

                with st.container(border=True):

                    col1, col2, col3 = st.columns([2, 3, 2])

                    col1.write(
                        f"**{case.get('case_reference', 'N/A')}**"
                    )

                    col2.write(
                        case.get("institution_name", "Not specified")
                    )

                    col3.write(
                        case.get("status", "Unknown")
                    )

        else:
            st.info("No verification cases have been created yet.")

    else:
        st.warning("Dashboard information could not be loaded.")


# ------------------------------------------------------------
# 7. APPLICANTS
# ------------------------------------------------------------

elif page == "Applicants":

    show_page_header(
        "Applicants",
        "Register applicants and view their submitted information."
    )

    st.markdown("### Register New Applicant")

    # The form collects basic applicant information.
    # The backend checks the submitted information and stores it.

    with st.form("applicant_form"):

        full_name = st.text_input("Full Name")
        email = st.text_input("Email Address")
        phone = st.text_input("Phone Number")

        submitted = st.form_submit_button(
            "Register Applicant",
            use_container_width=True
        )

        if submitted:

            if not full_name.strip() or not email.strip():

                st.warning("Full name and email are required.")

            else:

                result = api_post(
                    "/applicants",
                    {
                        "full_name": full_name.strip(),
                        "email": email.strip(),
                        "phone": phone.strip()
                    }
                )

                if result is not None:
                    st.success("Applicant registered successfully.")
                    st.rerun()

    st.divider()

    st.markdown("### Registered Applicants")

    applicants_data = api_get("/applicants")

    applicants = extract_list(
        applicants_data,
        ["applicants", "data"]
    )

    if applicants:

        for applicant in applicants:

            with st.container(border=True):

                st.write(
                    f"**{applicant.get('full_name', 'Unknown')}**"
                )

                col1, col2 = st.columns(2)

                col1.write(
                    f"Email: {applicant.get('email', 'N/A')}"
                )

                col2.write(
                    f"Phone: {applicant.get('phone') or 'N/A'}"
                )

    else:
        st.info("No applicants found.")


# ------------------------------------------------------------
# 8. VERIFICATION CASES
# ------------------------------------------------------------

elif page == "Verification Cases":

    show_page_header(
        "Verification Cases",
        "Create, search and monitor document verification cases."
    )

    st.markdown("### Create New Verification Case")

    applicants_data = api_get("/applicants")

    applicants = extract_list(
        applicants_data,
        ["applicants", "data"]
    )

    if applicants:

        # Map applicant names to their database IDs.
        applicant_options = {
            f"{a.get('full_name', 'Unknown')} ({a.get('email', 'N/A')})":
            a.get("id")
            for a in applicants
        }

        with st.form("case_form"):

            selected_applicant = st.selectbox(
                "Select Applicant",
                list(applicant_options.keys())
            )

            verification_type = st.selectbox(
                "Verification Type",
                [
                    "Educational",
                    "Professional",
                    "Identity"
                ]
            )

            institution_name = st.text_input(
                "Institution / Issuing Authority"
            )

            priority = st.selectbox(
                "Priority",
                ["Low", "Normal", "High"]
            )

            submitted = st.form_submit_button(
                "Create Verification Case",
                use_container_width=True
            )

            if submitted:

                if not institution_name.strip():

                    st.warning("Institution name is required.")

                else:

                    result = api_post(
                        "/cases",
                        {
                            "applicant_id": applicant_options[
                                selected_applicant
                            ],
                            "verification_type": verification_type,
                            "institution_name": institution_name.strip(),
                            "priority": priority
                        }
                    )

                    if result is not None:
                        st.success("Verification case created.")
                        st.rerun()

    else:
        st.warning(
            "Register an applicant before creating a verification case."
        )

    st.divider()

    st.markdown("### Search Verification Cases")

    search_col, filter_col = st.columns([2, 1])

    with search_col:

        search_term = st.text_input(
            "Search by case reference or institution"
        )

    with filter_col:

        status_filter = st.selectbox(
            "Filter by Status",
            [
                "All",
                "Pending",
                "In Review",
                "Verified",
                "Rejected"
            ]
        )

    # Send the selected search and filter values to the backend.
    params = {}

    if search_term.strip():
        params["search"] = search_term.strip()

    if status_filter != "All":
        params["status"] = status_filter

    cases_data = api_get("/cases", params=params)

    cases = extract_list(cases_data, ["cases", "data"])

    if cases:

        for case in cases:

            with st.container(border=True):

                col1, col2 = st.columns([3, 2])

                with col1:

                    st.write(
                        f"**{case.get('case_reference', 'N/A')}**"
                    )

                    st.write(
                        f"Applicant ID: {case.get('applicant_id', 'N/A')}"
                    )

                    st.write(
                        f"Institution: {case.get('institution_name', 'N/A')}"
                    )

                with col2:

                    display_status(
                        case.get("status", "Unknown")
                    )

                    st.write(
                        f"Type: {case.get('verification_type', 'N/A')}"
                    )

                    st.write(
                        f"Priority: {case.get('priority', 'Normal')}"
                    )

    else:
        st.info("No matching verification cases found.")


# ------------------------------------------------------------
# 9. CASE WORKSPACE
# ------------------------------------------------------------

elif page == "Case Workspace":

    show_page_header(
        "Case Workspace",
        "Manage documents, review information and track case activity."
    )

    cases_data = api_get("/cases")

    cases = extract_list(
        cases_data,
        ["cases", "data"]
    )

    if not cases:

        st.info("No verification cases are available.")

    else:

        # Display case references in a dropdown so the reviewer
        # can select the case they want to work on.

        case_options = {
            f"{c.get('case_reference', 'Unknown')} | "
            f"{c.get('institution_name', 'Unknown institution')}":
            c.get("id")
            for c in cases
        }

        selected_case = st.selectbox(
            "Select Verification Case",
            list(case_options.keys())
        )

        case_id = case_options[selected_case]

        # Retrieve detailed case information from the backend.
        case_data = api_get(f"/cases/{case_id}")

        # Some APIs return the case directly, while others place
        # it inside a "case" or "data" property.
        if isinstance(case_data, dict):

            case = case_data.get(
                "case",
                case_data.get("data", case_data)
            )

            if not isinstance(case, dict):
                case = {}

        else:
            case = {}

        st.divider()

        st.markdown("### Case Information")

        info_col1, info_col2, info_col3 = st.columns(3)

        info_col1.write(
            f"**Reference**\n\n{case.get('case_reference', 'N/A')}"
        )

        info_col2.write(
            f"**Verification Type**\n\n"
            f"{case.get('verification_type', 'N/A')}"
        )

        info_col3.write(
            f"**Institution**\n\n"
            f"{case.get('institution_name', 'N/A')}"
        )

        display_status(case.get("status", "Unknown"))

        st.divider()

        # ----------------------------------------------------
        # DOCUMENT MANAGEMENT
        # ----------------------------------------------------

        st.markdown("### Documents")

        documents_data = api_get(
            f"/cases/{case_id}/documents"
        )

        documents = extract_list(
            documents_data,
            ["documents", "data"]
        )

        if documents:

            for document in documents:

                with st.container(border=True):

                    st.write(
                        f"**{document.get('document_type', 'Document')}**"
                    )

                    col1, col2 = st.columns(2)

                    col1.write(
                        f"Document Number: "
                        f"{document.get('document_number') or 'Missing'}"
                    )

                    col2.write(
                        f"Issuing Authority: "
                        f"{document.get('issuing_authority') or 'Missing'}"
                    )

                    validation_status = document.get(
                        "validation_status",
                        "Pending"
                    )

                    st.write(
                        f"Validation Status: **{validation_status}**"
                    )

                    # Validation issues are stored as JSON by the
                    # backend. Convert them into readable text.

                    issues = document.get("validation_issues", [])

                    if isinstance(issues, str):

                        try:
                            issues = json.loads(issues)
                        except json.JSONDecodeError:
                            issues = [issues] if issues else []

                    if issues:

                        for issue in issues:
                            st.warning(str(issue))

                    # Allow the reviewer to run the validation
                    # checks again for an existing document.

                    if st.button(
                        "Validate Document",
                        key=f"validate_{document.get('id')}"
                    ):

                        result = api_post(
                            f"/documents/{document.get('id')}/validate"
                        )

                        if result is not None:
                            st.success("Document validation completed.")
                            st.rerun()

        else:

            st.info("No documents have been added to this case.")

        # ----------------------------------------------------
        # ADD DOCUMENT
        # ----------------------------------------------------

        st.markdown("### Add Document")

        with st.form("document_form"):

            document_type = st.selectbox(
                "Document Type",
                [
                    "Degree Certificate",
                    "Academic Transcript",
                    "Professional Licence",
                    "Identity Document",
                    "Other"
                ]
            )

            document_number = st.text_input(
                "Document Number"
            )

            issuing_authority = st.text_input(
                "Issuing Authority"
            )

            issue_date = st.text_input(
                "Issue Date (YYYY-MM-DD)"
            )

            expiry_date = st.text_input(
                "Expiry Date (YYYY-MM-DD)",
                help="Leave blank if the document has no expiry date."
            )

            submitted = st.form_submit_button(
                "Add Document",
                use_container_width=True
            )

            if submitted:

                result = api_post(
                    f"/cases/{case_id}/documents",
                    {
                        "document_type": document_type,
                        "document_number": document_number.strip(),
                        "issuing_authority": issuing_authority.strip(),
                        "issue_date": issue_date.strip(),
                        "expiry_date": expiry_date.strip()
                    }
                )

                if result is not None:
                    st.success("Document added to the verification case.")
                    st.rerun()

        st.divider()

        # ----------------------------------------------------
        # UPDATE CASE STATUS
        # ----------------------------------------------------

        st.markdown("### Update Verification Status")

        status_options = [
            "Pending",
            "In Review",
            "Verified",
            "Rejected"
        ]

        current_status = case.get("status", "Pending")

        if current_status not in status_options:
            current_status = "Pending"

        with st.form("status_form"):

            new_status = st.selectbox(
                "New Status",
                status_options,
                index=status_options.index(current_status)
            )

            reviewer_name = st.text_input(
                "Reviewer Name",
                value="Admin"
            )

            submitted = st.form_submit_button(
                "Update Status",
                use_container_width=True
            )

            if submitted:

                result = api_put(
                    f"/cases/{case_id}/status",
                    {
                        "status": new_status,
                        "reviewer_name": reviewer_name.strip()
                    }
                )

                if result is not None:
                    st.success("Verification status updated.")
                    st.rerun()

        st.divider()

        # ----------------------------------------------------
        # REVIEWER NOTES
        # ----------------------------------------------------

        st.markdown("### Reviewer Notes")

        with st.form("notes_form"):

            note_reviewer = st.text_input(
                "Reviewer Name",
                value="Admin"
            )

            note_text = st.text_area(
                "Add Review Note",
                placeholder="Enter observations or comments about this case..."
            )

            submitted = st.form_submit_button(
                "Save Note",
                use_container_width=True
            )

            if submitted:

                if not note_text.strip():

                    st.warning("Please enter a note.")

                else:

                    result = api_post(
                        f"/cases/{case_id}/notes",
                        {
                            "reviewer_name": note_reviewer.strip(),
                            "note": note_text.strip()
                        }
                    )

                    if result is not None:
                        st.success("Reviewer note saved.")
                        st.rerun()

        st.divider()

        # ----------------------------------------------------
        # AUDIT HISTORY
        # ----------------------------------------------------

        st.markdown("### Audit History")

        history_data = api_get(
            f"/cases/{case_id}/history"
        )

        history = extract_list(
            history_data,
            ["history", "logs", "audit_logs", "data"]
        )

        if history:

            for entry in history:

                with st.container(border=True):

                    st.write(
                        f"**{entry.get('action', 'Activity')}**"
                    )

                    st.write(
                        entry.get("details", "No additional details.")
                    )

                    st.caption(
                        f"Performed by: "
                        f"{entry.get('performed_by', 'System')} | "
                        f"Date: {entry.get('created_at', 'N/A')}"
                    )

        else:

            st.info("No audit history is available for this case.")


# ------------------------------------------------------------
# 10. APPLICATION FOOTER
# ------------------------------------------------------------

st.divider()

st.caption(
    "VerifyFlow | Document Verification Workflow Management System"
)

st.caption(
    "Prototype project. Document checks are limited to data-quality "
    "validation and do not independently authenticate documents "
    "with issuing authorities."
)