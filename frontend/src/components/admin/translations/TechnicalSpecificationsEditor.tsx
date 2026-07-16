import { AdminInput } from "../AdminComponents";

export interface TechnicalSpecification {
  label: string;
  value: string;
}

interface TechnicalSpecificationsEditorProps {
  value: TechnicalSpecification[];
  onChange: (value: TechnicalSpecification[]) => void;
}

export default function TechnicalSpecificationsEditor({
  value,
  onChange,
}: TechnicalSpecificationsEditorProps) {
  const updateItem = (
    index: number,
    field: "label" | "value",
    fieldValue: string,
  ) => {
    const updated = [...value];
    updated[index] = {
      ...updated[index],
      [field]: fieldValue,
    };

    onChange(updated);
  };

  const addSpecification = () => {
    onChange([
      ...value,
      {
        label: "",
        value: "",
      },
    ]);
  };

  const removeSpecification = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">
            Technical Specifications
          </h4>

          <p className="text-[12.5px] text-[#6B6B6B]">
            Add label and value rows for the translated table.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addSpecification}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]"
          >
            Add Spec
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {value.map((item, index) => (
          <div
            key={index}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end"
          >
            <AdminInput
              label="Label"
              value={item.label}
              onChange={(e) =>
                updateItem(index, "label", e.target.value)
              }
            />

            <AdminInput
              label="Value"
              value={item.value}
              onChange={(e) =>
                updateItem(index, "value", e.target.value)
              }
            />

            <button
              type="button"
              onClick={() => removeSpecification(index)}
              className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Remove
            </button>
          </div>
        ))}

        {value.length === 0 && (
          <p className="text-[13px] text-[#6B6B6B]">
            No technical specifications added yet.
          </p>
        )}
      </div>
    </div>
  );
}