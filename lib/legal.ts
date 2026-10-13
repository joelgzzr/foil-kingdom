// Legal entity and contact shown in the legal pages; set in the deployment environment.
export const legalEntity = process.env.NEXT_PUBLIC_LEGAL_ENTITY?.trim() || "Foil Kingdom";
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
