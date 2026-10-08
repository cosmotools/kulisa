// A profile's picture, as Chrome's profile avatars: an animal, each profile of a workspace its own, so panes are told
// apart by shape and colors at once (not by a color alone). The pictures are Noto Emoji's (Apache-2.0,
// src/renderer/avatars/), in this order: the most unlike ones first. Shared with the window through the preload (the
// new profile's picture, until the human picks another).
const AVATARS = ['fox', 'frog', 'panda', 'owl', 'octopus', 'lion', 'penguin', 'unicorn', 'cat', 'koala', 'tiger', 'monkey',
  'rabbit', 'bear', 'hedgehog', 'dog'];

// The first picture none of `used` has; after all of them, round again.
const nextAvatar = (used) => AVATARS.find((a) => !used.includes(a)) || AVATARS[used.length % AVATARS.length];

module.exports = { AVATARS, nextAvatar };
