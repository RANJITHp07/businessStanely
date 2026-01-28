type PhoneResult = {
  dialCode: string;
  nationalNumber: string;
  internationalNumber: string;
};

export function normalizePhoneNumber(
  phoneNumber: string,
  dialCode: string,
): PhoneResult {
  if (!dialCode)
    return {
      dialCode: "",
      nationalNumber: phoneNumber,
      internationalNumber: phoneNumber,
    };
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const cleanDial = dialCode.replace(/\D/g, "");

  let nationalNumber = cleanPhone;

  if (cleanPhone.startsWith(cleanDial)) {
    nationalNumber = cleanPhone.slice(cleanDial.length);
  }

  return {
    dialCode: cleanDial,
    nationalNumber,
    internationalNumber: `+${cleanDial} ${nationalNumber}`,
  };
}
