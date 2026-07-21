const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

/** Replace Latin digits with Arabic-Indic ones (١٢٣) for Arabic UI copy. */
export const toArabicDigits = (value: string): string =>
  value.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)])

/** Localize a formatted time/date string for Arabic: Arabic-Indic digits and
 *  the ص/م meridiem instead of AM/PM. No-op-safe for strings without either. */
export const localizeDateString = (value: string, isAr: boolean): string =>
  isAr
    ? toArabicDigits(value)
        .replace(/am/i, "ص")
        .replace(/pm/i, "م")
    : value
