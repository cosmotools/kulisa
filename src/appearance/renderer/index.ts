// appearance: public renderer entry; see ../README.md.
export { AppLogo, Logo, ProjectIcon } from './ProjectIcon';
export { projectColor, useProjectColor, onColors } from './project-color';
export { setTheme, useShade, termStyle, uiTextSize } from './theme';
export const avatarSrc = (avatar: string): string => `avatars/${avatar}.svg`;
