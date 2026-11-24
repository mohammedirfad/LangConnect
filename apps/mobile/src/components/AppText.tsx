import { Text, type TextProps } from 'react-native';
import { theme } from '../theme';

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: theme.fonts.family }, style]} />;
}
