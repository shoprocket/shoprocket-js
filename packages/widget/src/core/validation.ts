/**
 * Lightweight validation for immediate UX feedback
 * Heavy validation happens server-side on checkout submit
 */

export interface ValidationRule {
  test: (value: any) => boolean;
  message: string | ((field: string) => string);
}

/**
 * Basic validation rules for instant feedback
 */
export const ValidationRules = {
  required: {
    test: (value: any) => !!value && value !== '',
    message: (field: string) => `${field} is required`
  } as ValidationRule,
  
  email: {
    test: (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email'
  } as ValidationRule
};

/**
 * Validate a single field value against rules
 */
export function validateField(
  value: any,
  rules: Array<ValidationRule | keyof typeof ValidationRules>,
  fieldName?: string
): string | null {
  for (const rule of rules) {
    let validationRule: ValidationRule;
    
    if (typeof rule === 'string') {
      const ruleGetter = ValidationRules[rule];
      // Check if it's a function (like minLength, maxLength, postalCode)
      if (typeof ruleGetter === 'function') {
        // These require parameters, skip them
        continue;
      }
      validationRule = ruleGetter;
    } else {
      validationRule = rule;
    }
    
    if (!validationRule.test(value)) {
      return typeof validationRule.message === 'function' 
        ? validationRule.message(fieldName || 'This field')
        : validationRule.message;
    }
  }
  return null;
}

/**
 * Validate entire form data against schema
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  schema: Partial<Record<keyof T, Array<ValidationRule | keyof typeof ValidationRules>>>
): Partial<Record<keyof T, string | null>> {
  const errors: Partial<Record<keyof T, string | null>> = {};
  
  for (const [field, rules] of Object.entries(schema) as [keyof T, Array<ValidationRule | keyof typeof ValidationRules>][]) {
    if (rules && rules.length > 0) {
      const fieldName = field.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      errors[field] = validateField(data[field], rules, fieldName);
    }
  }
  
  return errors;
}

/**
 * Check if form has any validation errors
 */
export function hasErrors<T extends Record<string, any>>(errors: Partial<Record<keyof T, string | null>>): boolean {
  return Object.values(errors).some(error => error !== null);
}