"""API route tests with role-based access checks."""

from conftest import auth_header


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_register_creates_user_and_profile(client, db):
    res = client.post("/api/auth/register", json={
        "uid": "new-recruiter",
        "email": "new@corp.com",
        "name": "New Recruiter",
        "role": "recruiter",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["role"] == "recruiter"

    user = db.get_by_id("users", "new-recruiter")
    assert user.data
    assert user.data[0]["role"] == "recruiter"

    profile = db.get_by_field("recruiter_profiles", "user_id", "new-recruiter")
    assert profile.data


def test_register_candidate_creates_candidate_profile(client, db):
    res = client.post("/api/auth/register", json={
        "uid": "new-candidate",
        "email": "cand@school.edu",
        "name": "New Candidate",
        "role": "candidate",
    })
    assert res.status_code == 200

    profile = db.get_by_field("candidate_profiles", "user_id", "new-candidate")
    assert profile.data


def test_get_me_returns_role(client):
    res = client.get("/api/auth/me", headers=auth_header("recruiter"))
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "recruiter"
    assert body["email"] == "recruiter@test.com"


def test_recruiter_profile_onboarding_persists(client, db):
    get_res = client.get("/api/auth/recruiter-profile", headers=auth_header("recruiter"))
    assert get_res.status_code == 200
    assert get_res.json()["onboarding_completed"] is False

    put_res = client.put(
        "/api/auth/recruiter-profile",
        headers=auth_header("recruiter"),
        json={
            "company_name": "Acme Corp",
            "onboarding_completed": True,
            "email_notifications": False,
        },
    )
    assert put_res.status_code == 200
    body = put_res.json()
    assert body["company_name"] == "Acme Corp"
    assert body["onboarding_completed"] is True
    assert body["email_notifications"] is False

    stored = db.get_by_field("recruiter_profiles", "user_id", "recruiter-1")
    assert stored.data[0]["onboarding_completed"] is True
    assert stored.data[0]["company_name"] == "Acme Corp"
    assert stored.data[0]["email_notifications"] is False


def test_candidate_profile_onboarding_persists(client, db):
    put_res = client.put(
        "/api/auth/candidate-profile",
        headers=auth_header("candidate"),
        json={
            "college": "MIT",
            "branch": "CS",
            "github_url": "https://github.com/candidate",
            "resume_url": "https://drive.google.com/resume",
            "onboarding_completed": True,
        },
    )
    assert put_res.status_code == 200
    body = put_res.json()
    assert body["onboarding_completed"] is True
    assert body["college"] == "MIT"

    stored = db.get_by_field("candidate_profiles", "user_id", "candidate-1")
    assert stored.data[0]["onboarding_completed"] is True


def test_link_candidate(client, db):
    db.insert("candidates", {
        "email": "candidate@test.com",
        "name": "Candidate One",
        "job_id": "job-1",
        "pipeline_stage": "uploaded",
    })

    res = client.post("/api/auth/link-candidate", headers=auth_header("candidate"))
    assert res.status_code == 200
    assert res.json()["linked"] >= 1


def test_create_and_list_jobs_recruiter_only(client):
    create_res = client.post(
        "/api/jobs",
        headers=auth_header("recruiter"),
        json={
            "title": "Backend Engineer",
            "description": "Build APIs",
            "apply_enabled": True,
        },
    )
    assert create_res.status_code == 200
    job = create_res.json()
    assert job["title"] == "Backend Engineer"
    assert job.get("apply_slug")

    list_res = client.get("/api/jobs", headers=auth_header("recruiter"))
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_list_candidates(client, db):
    job = client.post(
        "/api/jobs",
        headers=auth_header("recruiter"),
        json={"title": "Role", "description": "Desc", "apply_enabled": False},
    ).json()

    db.insert("candidates", {
        "job_id": job["id"],
        "name": "Jane",
        "email": "jane@test.com",
        "pipeline_stage": "uploaded",
    })

    res = client.get(f"/api/candidates?job_id={job['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1


def test_candidate_applications_candidate_only(client, db):
    res = client.get("/api/candidate/applications", headers=auth_header("candidate"))
    assert res.status_code == 200
    assert "applications" in res.json()

    forbidden = client.get("/api/candidate/applications", headers=auth_header("recruiter"))
    assert forbidden.status_code == 403


def test_public_job_no_auth(client, db):
    job_res = client.post(
        "/api/jobs",
        headers=auth_header("recruiter"),
        json={"title": "Public Role", "description": "Open role", "apply_enabled": True},
    )
    slug = job_res.json()["apply_slug"]

    res = client.get(f"/api/public/jobs/{slug}")
    assert res.status_code == 200
    assert res.json()["title"] == "Public Role"


def test_role_matrix_recruiter_blocked_from_candidate_profile(client):
    res = client.get("/api/auth/candidate-profile", headers=auth_header("recruiter"))
    assert res.status_code == 403


def test_role_matrix_candidate_blocked_from_recruiter_profile(client):
    res = client.get("/api/auth/recruiter-profile", headers=auth_header("candidate"))
    assert res.status_code == 403


def test_role_matrix_candidate_blocked_from_jobs(client):
    res = client.get("/api/jobs", headers=auth_header("candidate"))
    assert res.status_code == 403
