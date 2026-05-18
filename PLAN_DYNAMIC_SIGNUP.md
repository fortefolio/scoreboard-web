# Implementation Plan: Dynamic Tournament Signup Form

This plan outlines the changes required to allow tournament organizers to define a custom signup form and for participants to fill it out during registration.

## Objective
Enable a flexible signup process where organizers can request specific information (e.g., T-shirt sizes, player skill levels, additional contact info) beyond the basic team name and email.

## 1. Backend Changes (Supabase / Database)

### `tournaments` table
- Add a `signup_schema` column (`JSONB`).
- **Structure**:
  ```json
  [
    { "id": "uuid", "label": "T-shirt Size", "type": "select", "required": true, "options": ["S", "M", "L", "XL"] },
    { "id": "uuid", "label": "Coach Name", "type": "text", "required": false }
  ]
  ```

### `tournament_participants` table
- Add a `custom_data` column (`JSONB`) to store the values for the dynamic fields.
- **Structure**:
  ```json
  { "t_shirt_size": "L", "coach_name": "John Doe" }
  ```

## 2. Frontend Changes (Organizer UI)

### `app/tournament/[id]/page.tsx` (Settings Tab)
- Add a "Signup Form Builder" section.
- **Features**:
  - Add new fields (Text, Select, Number, Checkbox).
  - Define field label, required status, and options (for selects).
  - Delete existing fields.
  - Save the schema to the `tournaments.signup_schema` column.

## 3. Frontend Changes (Public Signup UI)

### `app/tournament/[id]/signup/page.tsx`
- Fetch the `signup_schema` along with other tournament data.
- Dynamically render the form fields based on the schema.
- Implement validation for required fields.
- On submission:
  - Keep `name` and `contact_email` as primary columns.
  - Gather all other dynamic field values into a `customData` object.
  - Insert the record into `tournament_participants` with `custom_data: customData`.

## 4. Frontend Changes (Participant List)

### `app/tournament/[id]/page.tsx` (Teams Tab)
- (Optional but recommended) Allow organizers to view the custom data for each participant in a detail view or modal.

## 5. Verification Plan

### Manual Testing
1. **Organizer**:
   - Create a tournament.
   - Go to settings and add a few custom fields (one required, one select).
   - Save the settings.
2. **Participant**:
   - Navigate to the signup link.
   - Verify the custom fields are rendered correctly.
   - Try to submit without a required field (should fail).
   - Fill all fields and submit.
3. **Organizer Verification**:
   - Go back to the tournament page.
   - Verify the participant appears in the roster.
   - (If implemented) Verify the custom data is accessible.

### Regression Testing
- Ensure standard signups still work even if no custom fields are defined.
- Ensure max participant limits are still enforced.
