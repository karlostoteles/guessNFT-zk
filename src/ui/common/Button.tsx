import { motion } from 'framer-motion';
import { CSSProperties, ReactNode } from 'react';
import { sfx } from '@/shared/audio/sfx';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'yes' | 'no';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: CSSProperties;
}

const variants: Record<string, CSSProperties> = {
  primary: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#FFFFFE',
  },
  secondary: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,254,0.7)',
  },
  accent: {
    background: 'linear-gradient(135deg, #E8A444, #D4903A)',
    border: '1px solid rgba(232,164,68,0.3)',
    color: '#FFFFFE',
  },
  yes: {
    background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
    border: '1px solid rgba(76,175,80,0.3)',
    color: '#FFFFFE',
  },
  no: {
    background: 'linear-gradient(135deg, #E05555, #C04444)',
    border: '1px solid rgba(224,85,85,0.3)',
    color: '#FFFFFE',
  },
};

const sizes: Record<string, CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '13px', borderRadius: '8px' },
  md: { padding: '12px 24px', fontSize: '15px', borderRadius: '10px' },
  lg: { padding: '16px 32px', fontSize: '17px', borderRadius: '12px' },
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
}: ButtonProps) {
  return (
    <motion.button
      onClick={disabled ? onClick : () => { sfx.click(); onClick?.(); }}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.03, filter: 'brightness(1.15)' }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      style={{
        ...variants[variant],
        ...sizes[size],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        fontWeight: 600,
        letterSpacing: '0.02em',
        outline: 'none',
        transition: 'opacity 0.2s',
        backdropFilter: 'blur(10px)',
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}
