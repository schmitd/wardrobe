type IdentityClaims = {
  subject: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  nickname?: string;
  preferredUsername?: string;
} & Record<string, unknown>;

export type AuthenticatedUser = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
};

const stringClaim = (identity: IdentityClaims, ...keys: string[]) => {
  for (const key of keys) {
    const value = identity[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const splitName = (name?: string) => {
  if (!name) return {};
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

export const identityToUser = (identity: IdentityClaims): AuthenticatedUser => {
  const fullName = stringClaim(identity, "name", "full_name");
  const fallbackName = splitName(fullName);
  const user: AuthenticatedUser = {
    userId: identity.subject,
  };
  const email = stringClaim(identity, "email", "email_address");
  const firstName =
    stringClaim(identity, "givenName", "given_name", "firstName", "first_name") ??
    fallbackName.firstName;
  const lastName =
    stringClaim(identity, "familyName", "family_name", "lastName", "last_name") ??
    fallbackName.lastName;

  if (email) user.email = email;
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (fullName) user.fullName = fullName;

  return user;
};

export const getAuthenticatedUser = async (ctx: {
  auth: { getUserIdentity: () => Promise<IdentityClaims | null> };
}) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity ? identityToUser(identity) : null;
};

export const getAuthenticatedUserId = async (ctx: {
  auth: { getUserIdentity: () => Promise<IdentityClaims | null> };
}) => {
  const user = await getAuthenticatedUser(ctx);
  return user?.userId ?? null;
};
