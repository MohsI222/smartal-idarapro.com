import { createContext, useContext, ReactNode, useCallback, useRef, useEffect } from "react";

interface FieldDefinition {
  name: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: "text" | "email" | "phone" | "date" | "number" | "textarea";
}

interface FormContextValue {
  registerField: (field: FieldDefinition) => void;
  unregisterField: (fieldName: string) => void;
  updateFieldValue: (fieldName: string, value: string) => void;
  getFields: () => FieldDefinition[];
  getFieldNames: () => string[];
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const fieldsRef = useRef<Map<string, FieldDefinition>>(new Map());

  const registerField = useCallback((field: FieldDefinition) => {
    fieldsRef.current.set(field.name, field);
  }, []);

  const unregisterField = useCallback((fieldName: string) => {
    fieldsRef.current.delete(fieldName);
  }, []);

  const updateFieldValue = useCallback((fieldName: string, value: string) => {
    const field = fieldsRef.current.get(fieldName);
    if (field) {
      field.setValue(value);
    }
  }, []);

  const getFields = useCallback(() => {
    return Array.from(fieldsRef.current.values());
  }, []);

  const getFieldNames = useCallback(() => {
    return Array.from(fieldsRef.current.keys());
  }, []);

  return (
    <FormContext.Provider
      value={{
        registerField,
        unregisterField,
        updateFieldValue,
        getFields,
        getFieldNames,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useFormContext must be used within FormProvider");
  }
  return context;
}

export function useFormField(fieldDef: Omit<FieldDefinition, "setValue">) {
  const { registerField, unregisterField } = useFormContext();

  const setValue = useCallback((value: string) => {
    fieldDef.setValue?.(value);
  }, [fieldDef.setValue]);

  useEffect(() => {
    registerField({ ...fieldDef, setValue });
    return () => {
      unregisterField(fieldDef.name);
    };
  }, [fieldDef, registerField, unregisterField, setValue]);

  return { setValue };
}
