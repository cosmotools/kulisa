// A profile's picture (shared/avatars.ts): its file, in public/avatars (as lib/common.ts's, which would bring the tasks'
// window's chunk into Settings' page).
export const avatarSrc = (a: string): string => `avatars/${a}.svg`;
