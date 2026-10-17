# Shikshak Diary (Advanced) – Plan

A teacher diary app for Myagdi Multiple Campus style reporting. Data stays on this device. Several teachers can use it, each with a separate profile. All dates are in Bikram Sambat (BS).

## Screens

1. **Teacher profiles** – pick or add a teacher (name, designation, department). Each profile keeps its own data. Backup/restore file (export/import) per profile.
2. **Home** – campus name, teacher name with designation, my classes with course completion % (LH done / total LH), major activities progress, upcoming events and reminders. **Setup** button at top-right.
3. **Setup** – campus info, teacher name + designation, HOD and campus chief names; classes (class, subject, code, total LH, student list) – "best teaching method" removed from class setup; campus academic calendar (regular classes, internal exam, result/feedback, Dashain-Tihar, winter, summer holidays, events) by single date or date range.
4. **Plans**
   - Annual working plan / unit plan: unit, main topics, LH, teaching methods & materials, assessment (quiz, class test, unit test, oral), from–to dates – one row per unit.
   - Monthly and daily teaching plan.
   - Period-wise lesson plan (Lesson title, level, duration, objectives with Bloom's level, steps with time + activity + learning theory, resources, assessment/feedback).
   - Print with signature lines: Subject teacher, HOD, Campus Chief (approval).
5. **Daily diary** – choose class and date: total/present/absent students, absence reasons, attendance per student, activity short-codes (L, ICT, R, SA, P, Q...), methods used, student activities, feedback, evaluation, LH covered.
6. **Records**
   - Student assessments: assignment, project work, presentation, oral, quiz, homework, class test, unit test – marks + teacher's short comment; rubric-based unit assessment (100 marks).
   - Internal and final exam marks.
   - Other activities: research (mini research, journal article, committee, thesis/project supervision), extra classes, administrative work, social contribution, expert service, entrepreneurship, student welfare, writing/editing, quality improvement, best teaching method used.
   - Reminders / future tasks with calendar view.
7. **Reports** (all printable)
   - Student report: present days, assessment summary, internal exam, final exam.
   - Teacher daily report.
   - Monthly performance report on one page: date, day, each class column with "No of students" + "Activities" short codes, remarks; then Status of Teaching Progress (total LH, completed up to previous month, this month, total to date, remaining), leave days, research progress, additional activities, Submitted by / Checked by.
   - Annual plan vs. actual progress report.

## Look
Clean, print-friendly, Devanagari-friendly font (Mukta), bilingual labels (English + Nepali), works on phone and computer, dark mode.

## Technical details
- TanStack routes per screen; state in a typed local store (localStorage, keyed per teacher profile) with JSON export/import.
- BS date conversion via a lookup table utility (BS months, weekday), BS date picker.
- Print via dedicated print layouts and `@media print`.
- Unit tests for LH progress calculations and BS conversion.
