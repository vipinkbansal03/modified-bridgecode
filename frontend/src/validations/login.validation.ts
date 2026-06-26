import * as Yup from "yup";

export const loginInitialValues = {
  email: "",
  password: "",
  rememberMe: false,
};

export type LoginFormValues = typeof loginInitialValues;

export const loginValidationSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email("Invalid email")
    .required("Email is required"),

  password: Yup.string()
    .min(6, "Min 6 characters")
    .required("Password is required"),

  rememberMe: Yup.boolean(),
});
