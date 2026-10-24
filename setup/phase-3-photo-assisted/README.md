# Phase 3: Photo-Assisted Verification (Local Face Detection)

## Scope
1. Implement local OpenCV Haar Cascade face detection (no cloud APIs, 100% offline).
2. **Strict Privacy Policy:**
   - NO facial recognition.
   - NO facial embeddings or identity guessing.
   - Visible face crops presented only on a temporary review screen for teacher manual pairing.
   - Unrecognized / absent students are NEVER automatically marked absent.
   - Auto-purging of temporary crops upon session completion.
3. Build endpoints:
   - `POST /api/photo-review/detect`
   - `POST /api/photo-review/confirm`
   - `DELETE /api/photo-review/<id>`
4. Build Photo Review UI with webcam / file upload, face thumbnails, and roster match selectors.
