import { CharacterTraits } from './traits';

export interface Character {
  id: string;
  name: string;
  traits: CharacterTraits;
  imageUrl?: string;
}

// 24 characters with balanced trait distribution
// Each boolean trait appears on ~6-8 characters
// Each enum value appears on ~3-5 characters
export const CHARACTERS: Character[] = [
  // Row 1
  {
    id: 'c01', name: 'Luna',
    traits: { hair_color: 'blue', hair_style: 'long', skin_tone: 'light', gender: 'female', eye_color: 'green', has_glasses: false, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c02', name: 'Max',
    traits: { hair_color: 'brown', hair_style: 'short', skin_tone: 'medium', gender: 'male', eye_color: 'brown', has_glasses: true, has_hat: false, has_beard: true, has_earrings: false },
  },
  {
    id: 'c03', name: 'Aria',
    traits: { hair_color: 'black', hair_style: 'curly', skin_tone: 'dark', gender: 'female', eye_color: 'brown', has_glasses: false, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c04', name: 'Kai',
    traits: { hair_color: 'blonde', hair_style: 'mohawk', skin_tone: 'light', gender: 'male', eye_color: 'blue', has_glasses: false, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c05', name: 'Zara',
    traits: { hair_color: 'red', hair_style: 'long', skin_tone: 'tan', gender: 'female', eye_color: 'green', has_glasses: true, has_hat: false, has_beard: false, has_earrings: false },
  },
  {
    id: 'c06', name: 'Riku',
    traits: { hair_color: 'white', hair_style: 'short', skin_tone: 'light', gender: 'male', eye_color: 'hazel', has_glasses: false, has_hat: true, has_beard: false, has_earrings: false },
  },
  // Row 2
  {
    id: 'c07', name: 'Nora',
    traits: { hair_color: 'brown', hair_style: 'ponytail', skin_tone: 'medium', gender: 'female', eye_color: 'blue', has_glasses: false, has_hat: false, has_beard: false, has_earrings: false },
  },
  {
    id: 'c08', name: 'Axel',
    traits: { hair_color: 'black', hair_style: 'short', skin_tone: 'very_dark', gender: 'male', eye_color: 'brown', has_glasses: false, has_hat: true, has_beard: true, has_earrings: false },
  },
  {
    id: 'c09', name: 'Ivy',
    traits: { hair_color: 'blonde', hair_style: 'long', skin_tone: 'light', gender: 'female', eye_color: 'blue', has_glasses: false, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c10', name: 'Omar',
    traits: { hair_color: 'black', hair_style: 'curly', skin_tone: 'tan', gender: 'male', eye_color: 'brown', has_glasses: true, has_hat: false, has_beard: true, has_earrings: false },
  },
  {
    id: 'c11', name: 'Mika',
    traits: { hair_color: 'red', hair_style: 'short', skin_tone: 'light', gender: 'female', eye_color: 'hazel', has_glasses: false, has_hat: true, has_beard: false, has_earrings: false },
  },
  {
    id: 'c12', name: 'Dex',
    traits: { hair_color: 'brown', hair_style: 'bald', skin_tone: 'dark', gender: 'male', eye_color: 'green', has_glasses: true, has_hat: false, has_beard: true, has_earrings: false },
  },
  // Row 3
  {
    id: 'c13', name: 'Sage',
    traits: { hair_color: 'blue', hair_style: 'short', skin_tone: 'medium', gender: 'female', eye_color: 'brown', has_glasses: true, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c14', name: 'Leo',
    traits: { hair_color: 'blonde', hair_style: 'curly', skin_tone: 'tan', gender: 'male', eye_color: 'green', has_glasses: false, has_hat: false, has_beard: false, has_earrings: false },
  },
  {
    id: 'c15', name: 'Yuki',
    traits: { hair_color: 'black', hair_style: 'long', skin_tone: 'light', gender: 'female', eye_color: 'brown', has_glasses: false, has_hat: false, has_beard: false, has_earrings: false },
  },
  {
    id: 'c16', name: 'Finn',
    traits: { hair_color: 'red', hair_style: 'mohawk', skin_tone: 'medium', gender: 'male', eye_color: 'blue', has_glasses: false, has_hat: false, has_beard: true, has_earrings: true },
  },
  {
    id: 'c17', name: 'Cleo',
    traits: { hair_color: 'white', hair_style: 'long', skin_tone: 'dark', gender: 'female', eye_color: 'hazel', has_glasses: false, has_hat: false, has_beard: false, has_earrings: true },
  },
  {
    id: 'c18', name: 'Jace',
    traits: { hair_color: 'brown', hair_style: 'short', skin_tone: 'light', gender: 'male', eye_color: 'blue', has_glasses: false, has_hat: true, has_beard: false, has_earrings: false },
  },
  // Row 4
  {
    id: 'c19', name: 'Raya',
    traits: { hair_color: 'black', hair_style: 'ponytail', skin_tone: 'tan', gender: 'female', eye_color: 'green', has_glasses: true, has_hat: false, has_beard: false, has_earrings: false },
  },
  {
    id: 'c20', name: 'Blake',
    traits: { hair_color: 'blonde', hair_style: 'short', skin_tone: 'medium', gender: 'male', eye_color: 'hazel', has_glasses: false, has_hat: false, has_beard: true, has_earrings: false },
  },
  {
    id: 'c21', name: 'Tara',
    traits: { hair_color: 'brown', hair_style: 'curly', skin_tone: 'very_dark', gender: 'female', eye_color: 'brown', has_glasses: false, has_hat: true, has_beard: false, has_earrings: true },
  },
  {
    id: 'c22', name: 'Soren',
    traits: { hair_color: 'white', hair_style: 'ponytail', skin_tone: 'light', gender: 'male', eye_color: 'blue', has_glasses: true, has_hat: false, has_beard: true, has_earrings: false },
  },
  {
    id: 'c23', name: 'Nina',
    traits: { hair_color: 'blue', hair_style: 'curly', skin_tone: 'dark', gender: 'female', eye_color: 'blue', has_glasses: false, has_hat: true, has_beard: false, has_earrings: false },
  },
  {
    id: 'c24', name: 'Cruz',
    traits: { hair_color: 'red', hair_style: 'bald', skin_tone: 'very_dark', gender: 'male', eye_color: 'brown', has_glasses: false, has_hat: false, has_beard: true, has_earrings: true },
  },
];
