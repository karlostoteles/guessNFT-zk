export type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'white' | 'blue';
export type HairStyle = 'short' | 'long' | 'curly' | 'bald' | 'mohawk' | 'ponytail';
export type SkinTone = 'light' | 'medium' | 'tan' | 'dark' | 'very_dark';
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel';
export type Gender = 'male' | 'female';

export interface CharacterTraits {
  hair_color: HairColor;
  hair_style: HairStyle;
  skin_tone: SkinTone;
  gender: Gender;
  eye_color: EyeColor;
  has_glasses: boolean;
  has_hat: boolean;
  has_beard: boolean;
  has_earrings: boolean;
  // SCHIZODIO NFT-specific traits (optional — only present on NFT characters)
  nft_hair?: string;
  nft_eyes?: string;
  nft_mouth?: string;
  nft_eyebrows?: string;
  nft_body?: string;
  nft_clothing?: string;
  nft_sidekick?: string;
  nft_background?: string;
  nft_has_mask?: boolean;
  nft_has_weapons?: boolean;
  nft_has_eyewear?: boolean;
  nft_has_headwear?: boolean;
  nft_has_accessories?: boolean;
  nft_has_overlay?: boolean;
  nft_has_sidekick?: boolean;
}

export const SKIN_COLORS: Record<SkinTone, string> = {
  light: '#FDDCB5',
  medium: '#E8B88A',
  tan: '#C98A5E',
  dark: '#8D5B3C',
  very_dark: '#5C3A21',
};

export const HAIR_COLORS: Record<HairColor, string> = {
  black: '#1a1a1a',
  brown: '#6B3A2A',
  blonde: '#E8D44D',
  red: '#C04030',
  white: '#E8E8E8',
  blue: '#4488DD',
};

export const EYE_COLORS: Record<EyeColor, string> = {
  brown: '#5C3317',
  blue: '#3388CC',
  green: '#2E8B57',
  hazel: '#8E7618',
};
