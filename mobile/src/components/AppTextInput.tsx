import { TextInput as PaperTextInput } from 'react-native-paper';

// A thin wrapper over Paper's TextInput that defaults every field in the
// app to the "outlined" look (rounded border, floating label) instead of
// Paper's default underlined "flat" style - forms otherwise look like an
// old-fashioned dense form. Every prop still passes straight through, so
// existing screens only need to swap the import/tag name, no other changes.
export default function AppTextInput(props: React.ComponentProps<typeof PaperTextInput>) {
  return <PaperTextInput mode="outlined" {...props} />;
}

AppTextInput.Affix = PaperTextInput.Affix;
AppTextInput.Icon = PaperTextInput.Icon;
