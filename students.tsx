import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/app/ui";

/** Kept as a compatibility route for old bookmarks; student management now lives in Setup. */
export const Route = createFileRoute("/students")({ component: StudentsRedirect });
function StudentsRedirect() {
  return <Page title="विद्यार्थी · Students" sub="Student management has moved into Setup so students can be added while managing their class."><section className="panel"><p className="mb-3 text-sm">कक्षा छनोट, विद्यार्थी थप्ने, सम्पादन गर्ने र पुरानो अभिलेख सुरक्षित राखेर निष्क्रिय बनाउने सुविधा अब एउटै ठाउँमा छ।</p><Link to="/setup" className="btn">Open Setup → Classes & Students</Link></section></Page>;
}
