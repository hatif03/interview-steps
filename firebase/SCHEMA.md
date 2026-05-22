# Firestore Schema

## Screening pipeline

| Collection | Doc ID | Key fields |
|------------|--------|------------|
| `jobs` | UUID | title, description, weight_config, created_at |
| `candidates` | UUID | job_id, name, email, resume_text, pipeline_stage, userId? |
| `evaluations` | `{candidate_id}_{job_id}` | candidate_id, job_id, scores, explanation, candidateName |
| `scores` | `{candidate_id}_{job_id}` | candidate_id, job_id, composite_score, rank, score_breakdown |
| `test_results` | candidate_id | candidate_id, job_id, test_la, test_code |
| `scheduled_interviews` | UUID | candidate_id, job_id, scheduled_at, google_meet_link |
| `email_logs` | UUID | candidate_id, job_id, email_type, status, sent_at |

## Auth & mock interviews

| Collection | Doc ID | Key fields |
|------------|--------|------------|
| `users` | Firebase UID | email, name, role (recruiter \| candidate) |
| `mock_interviews` | UUID | candidateId, jobId, questions[], role, type, level, userId |
| `mock_sessions` | UUID | mockInterviewId, transcript[], status, currentQuestionIndex |
| `mock_feedback` | UUID | interviewId, sessionId, candidateId, totalScore, categoryScores |

## Pipeline stages

uploaded → resume_processed → evaluating → evaluated → ranked → test_sent → test_completed → mock_interview_assigned → mock_interview_completed → interview_scheduled → error
