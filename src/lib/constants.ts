export const CAL_TYPES = ["Regular classes", "Internal exam", "Result and feedback", "Final exam", "Dashain–Tihar holiday", "Winter holiday", "Summer holiday", "Public holiday", "Personal leave", "Event"];
export const HOLIDAY_TYPES = ["Dashain–Tihar holiday", "Winter holiday", "Summer holiday", "Public holiday"];
export const ASSESS_KINDS = ["Assignment", "Project work", "Presentation", "Homework", "Quiz", "Oral question", "Class test", "Unit test", "Unit assessment (rubric)", "Internal exam", "Final exam"];
export const RESEARCH_CATS = ["Mini research", "Journal article", "Research committee work", "Thesis supervision", "Project work supervision"];
export const ACT_CATS = [
  ...RESEARCH_CATS, "Extra class", "Best teaching method used", "Administrative responsibility", "Social contribution",
  "Expert service", "Entrepreneurship and employment", "Student welfare", "Writing, editing, publishing",
  "Campus quality improvement", "Invigilation / exam duty", "Other",
];
export const CODES: [string, string][] = [
  ["L", "Lecture"], ["ICT", "ICT / PPT"], ["D", "Discussion"], ["GW", "Group work"], ["P", "Presentation"],
  ["Q", "Quiz"], ["OQ", "Oral question"], ["SA", "Student activity"], ["Dm", "Demonstration"], ["PW", "Project work"],
  ["CT", "Class test"], ["R", "Revision"], ["F", "Feedback"],
];
export const RUBRIC = [
  ["Understanding of concepts", 25], ["Application / problem solving", 25], ["Presentation & communication", 20],
  ["Participation & teamwork", 15], ["Timeliness & originality", 15],
] as const;
