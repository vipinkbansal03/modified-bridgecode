import { Card } from "@/components/ui/Card";

type Props = {
  submission: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    subject: string | null;
    type: string | null;
    message: string;
    createdAt: string;
  };
};

const Row = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-6 border-b border-gray-100 py-3 last:border-0">
    <span className="min-w-[120px] text-sm text-gray-500">
      {label}
    </span>

    <span className="flex-1 text-right text-sm font-medium text-gray-900 break-words">
      {value || "-"}
    </span>
  </div>
);

export default function ContactSubmissionDetails({
  submission,
}: Props) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Contact Information
        </h2>

        <Row label="Name" value={submission.name} />
        <Row label="Email" value={submission.email} />
        <Row label="Phone" value={submission.phone} />
        <Row label="Company" value={submission.company} />
        <Row label="Subject" value={submission.subject} />
        <Row label="Type" value={submission.type} />
        <Row
          label="Submitted"
          value={new Date(submission.createdAt).toLocaleString()}
        />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Message
        </h2>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-sm leading-6">
          {submission.message}
        </div>
      </Card>
    </div>
  );
}