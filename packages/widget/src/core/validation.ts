/**
 * Centralized validation system for form fields
 * Provides reusable validation rules and utilities
 */

export interface ValidationRule {
  test: (value: any) => boolean;
  message: string | ((field: string) => string);
}

/**
 * Built-in validation rules
 */
export const ValidationRules = {
  required: {
    test: (value: any) => !!value && value !== '',
    message: (field: string) => `${field} is required`
  } as ValidationRule,
  
  email: {
    test: (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email'
  } as ValidationRule,
  
  minLength: (min: number): ValidationRule => ({
    test: (value: string) => !value || value.length >= min,
    message: `Must be at least ${min} characters`
  }),
  
  maxLength: (max: number): ValidationRule => ({
    test: (value: string) => !value || value.length <= max,
    message: `Must be no more than ${max} characters`
  }),
  
  phone: {
    test: (value: string) => !value || /^[\d\s\-\+\(\)]+$/.test(value),
    message: 'Please enter a valid phone number'
  } as ValidationRule,
  
  postalCode: (country?: string): ValidationRule => ({
    test: (value: string) => {
      if (!value) return false; // Required check happens separately
      
      // Country-specific postal code validation
      const patterns: Record<string, RegExp> = {
        US: /^\d{5}(-\d{4})?$/,
        UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
        CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
        AU: /^\d{4}$/,
        DE: /^\d{5}$/,
        FR: /^\d{5}$/,
        JP: /^\d{3}-?\d{4}$/,
        // Add more as needed
      };
      
      return country && patterns[country] ? patterns[country].test(value) : true;
    },
    message: 'Please enter a valid postal code'
  })
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

/**
 * Countries that require state/province
 */
export const COUNTRIES_WITH_STATES = ['US', 'CA', 'AU', 'BR', 'IN', 'MX'];

/**
 * Check if country requires state/province
 */
export function requiresState(countryCode: string): boolean {
  return COUNTRIES_WITH_STATES.includes(countryCode);
}