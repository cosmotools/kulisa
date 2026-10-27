// A profile's picture, as Chrome's profile avatars: an animal, each profile of a task its own, so panes are told
// apart by shape and colors at once (not by a color alone). The pictures are Noto Emoji's (Apache-2.0,
// src/renderer/public/avatars/), in this order: the most unlike ones first. The window imports it too (components/ProfilePage.tsx).
const AVATARS = ['fox', 'frog', 'panda', 'owl', 'octopus', 'lion', 'penguin', 'unicorn', 'cat', 'koala', 'tiger', 'monkey',
  'rabbit', 'bear', 'hedgehog', 'dog'];

// The first picture none of `used` has; after all of them, round again.
const nextAvatar = (used: string[]) => AVATARS.find((a) => !used.includes(a)) || AVATARS[used.length % AVATARS.length]!;

export { AVATARS, nextAvatar };
