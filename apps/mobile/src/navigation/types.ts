export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

export type AppStackParamList = {
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
};
