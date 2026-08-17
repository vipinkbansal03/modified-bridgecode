import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/admin/AdminComponents";

export interface UseAdminFormOptions<T> {
  enableReinitialize?: boolean;
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  validationSchema?: any;
  onSubmit: (
    values: T,
    helpers: { setSubmitting: (isSubmitting: boolean) => void; resetForm: (newInitialValues?: T) => void; setStatus: (status: any) => void; setErrors: (errors: any) => void }
  ) => Promise<void>;
  onClose?: () => void;
}

export function useAdminForm<T extends Record<string, any>>({
  enableReinitialize = false,
  initialValues,
  validate,
  validationSchema,
  onSubmit,
  onClose,
}: UseAdminFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [initialValuesState, setInitialValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const prevInitialValuesStr = useRef(JSON.stringify(initialValues));

  useEffect(() => {
    if (enableReinitialize) {
      const currentStr = JSON.stringify(initialValues);
      if (currentStr !== prevInitialValuesStr.current) {
        setValues(initialValues);
        setInitialValuesState(initialValues);
        prevInitialValuesStr.current = currentStr;
      }
    }
  }, [enableReinitialize, initialValues]);

  const runValidation = useCallback((vals: T) => {
    let errs: any = {};
    if (validationSchema) {
      try {
        validationSchema.validateSync(vals, { abortEarly: false });
      } catch (err: any) {
        if (err.inner) {
          err.inner.forEach((e: any) => {
            if (e.path) errs[e.path] = e.message;
          });
        }
      }
    }
    if (validate) {
      errs = { ...errs, ...validate(vals) };
    }
    return errs as Partial<Record<keyof T, string>>;
  }, [validationSchema, validate]);

  const reset = useCallback(
    (newInitialValues?: T) => {
      const vals = newInitialValues ?? initialValues;
      setValues(vals);
      setInitialValuesState(vals);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setStatus(null);
    },
    [initialValues]
  );

  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        if (touched[field] || errors[field]) {
          const newErrors = runValidation(next);
          setErrors((prevErrors) => ({
            ...prevErrors,
            [field]: newErrors[field],
          }));
        }
        return next;
      });
    },
    [touched, errors, runValidation]
  );

  const handleChange = useCallback(
    (eOrField: any, value?: any) => {
      if (typeof eOrField === "string") {
        setFieldValue(eOrField as keyof T, value);
      } else if (eOrField && eOrField.target) {
        const field = eOrField.target.name || eOrField.target.id;
        const val = eOrField.target.type === "checkbox" ? eOrField.target.checked : eOrField.target.value;
        if (field) setFieldValue(field as keyof T, val);
      }
    },
    [setFieldValue]
  );

  const handleBlur = useCallback(
    (eOrField: any) => {
      let field: keyof T | undefined;
      if (typeof eOrField === "string") {
        field = eOrField as keyof T;
      } else if (eOrField && eOrField.target) {
        field = (eOrField.target.name || eOrField.target.id) as keyof T;
      }
      
      if (field) {
        setTouched((prev) => ({ ...prev, [field as keyof T]: true }));
        const newErrors = runValidation(values);
        setErrors((prev) => ({ ...prev, [field as keyof T]: newErrors[field as keyof T] }));
      }
    },
    [values, runValidation]
  );

  const handleClose = useCallback(() => {
    if (JSON.stringify(values) !== JSON.stringify(initialValuesState)) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    if (onClose) onClose();
  }, [values, initialValuesState, onClose]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      const newErrors = runValidation(values);
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        
        const newTouched = { ...touched };
        Object.keys(newErrors).forEach((key) => {
          newTouched[key as keyof T] = true;
        });
        setTouched(newTouched);

        const firstErrorField = Object.keys(newErrors)[0];
        if (firstErrorField) {
          setTimeout(() => {
            const el = document.getElementById(`field-${firstErrorField}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.focus();
            }
          }, 50);
        }
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values, { setSubmitting: setIsSubmitting, resetForm: reset, setStatus, setErrors });
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, runValidation, touched, onSubmit, reset]
  );

  const getFieldProps = useCallback(
    <K extends keyof T>(name: K) => ({
      name: name as string,
      value: (values[name] !== undefined ? values[name] : "") as any,
      onChange: handleChange,
      onBlur: handleBlur,
    }),
    [values, handleChange, handleBlur]
  );

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValuesState);

  return {
    values,
    setValues,
    errors,
    setErrors,
    touched,
    isSubmitting,
    dirty,
    status,
    setStatus,
    handleChange,
    handleBlur,
    handleSubmit,
    handleClose,
    setFieldValue,
    getFieldProps,
    reset,
  };
}
