import { QRScanner } from '@/components/account';
import { EmailInputScreen, EmailIntegrationScreen, EmailParsingScreen } from '@/components/settings';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLanguage } from '@/hooks/useLanguage';
import { AccountService } from '@/services/accountService';
import { OTPService } from '@/services/otpService';
import type { Account, AccountCategory, AuthType } from '@/types/auth';
import { determineCategory } from '@/utils/totpParser';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Mail,
  Plus,
  QrCode,
  Shield,
  Type
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function AddScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { t } = useLanguage();
  
  const [showManualForm, setShowManualForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showEmailIntegration, setShowEmailIntegration] = useState(false);
  const [showEmailParsing, setShowEmailParsing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [emailConfig, setEmailConfig] = useState<{
    email: string;
    password: string;
    protocol: 'IMAP' | 'POP3';
    imapServer: string;
    imapPort: string;
    smtpServer: string;
    smtpPort: string;
    useSsl: boolean;
  } | undefined>(undefined);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    secret: '',
    type: 'TOTP' as AuthType,
    category: 'Other' as AccountCategory,
    // Type-specific fields
    pin: '', // For mOTP
    counter: '0', // For HOTP
    // Advanced options
    algorithm: 'SHA1' as 'SHA1' | 'SHA256' | 'SHA512',
    digits: '6',
    period: '30', // For TOTP
  });

  const handleQRScan = () => {
    setShowQRScanner(true);
  };

  const handleQRScanResult = async (data: string) => {
    setShowQRScanner(false);
    
    try {
      const parsedData = OTPService.parseOTPUri(data);
      if (parsedData) {
        // Create a complete account object
        const newAccount = {
          name: parsedData.name || '',
          email: parsedData.email || '',
          secret: parsedData.secret || '',
          type: parsedData.type || 'TOTP' as AuthType,
          category: determineCategory(parsedData.name || ''),
          issuer: parsedData.issuer,
          algorithm: parsedData.algorithm || 'SHA1' as 'SHA1' | 'SHA256' | 'SHA512',
          digits: parsedData.digits || 6,
          period: parsedData.period || 30,
          counter: parsedData.counter || 0,
          pin: parsedData.pin || undefined,
        };

        // Validate required fields
        if (!newAccount.name || !newAccount.email || !newAccount.secret) {
          Alert.alert(
            t('add.alerts.scanFailed'),
            t('add.alerts.incompleteData'),
            [
              { text: t('add.alerts.manualInput'), onPress: () => {
                // Auto-fill form with scanned data
                setFormData({
                  name: newAccount.name,
                  email: newAccount.email,
                  secret: newAccount.secret,
                  type: newAccount.type,
                  category: newAccount.category,
                  pin: newAccount.pin || '',
                  counter: newAccount.counter.toString(),
                  algorithm: newAccount.algorithm,
                  digits: newAccount.digits.toString(),
                  period: newAccount.period.toString(),
                });
                setShowManualForm(true);
              }},
              { text: t('add.alerts.cancel') }
            ]
          );
          return;
        }

        // Save the account using AccountService
        const savedAccount = await AccountService.addAccount(newAccount);
        
        Alert.alert(
          t('add.alerts.scanSuccess'),
          t('add.alerts.scanSuccessMessage', { name: savedAccount.name }),
          [{ text: t('add.alerts.ok') }]
        );
      } else {
        Alert.alert(
          t('add.alerts.scanFailed'),
          t('add.alerts.scanFailedMessage'),
          [
            { text: t('add.alerts.manualInput'), onPress: () => setShowManualForm(true) },
            { text: t('add.alerts.rescan'), onPress: () => setShowQRScanner(true) },
            { text: t('add.alerts.cancel') }
          ]
        );
      }
    } catch (error) {
      console.error('Error processing QR scan result:', error);
      Alert.alert(
        t('add.alerts.error'),
        error instanceof Error ? error.message : t('add.alerts.unknownError'),
        [{ text: t('add.alerts.ok') }]
      );
    }
  };

  const handleQRScanClose = () => {
    setShowQRScanner(false);
  };

  const handleEmailImport = () => {
    setShowEmailInput(true);
  };

  const handleEmailInputContinue = (config: {
    email: string;
    password: string;
    protocol: 'IMAP' | 'POP3';
    imapServer: string;
    imapPort: string;
    smtpServer: string;
    smtpPort: string;
    useSsl: boolean;
  }) => {
    setEmailConfig(config);
    setUserEmail(config.email);
    setShowEmailInput(false);
    setShowEmailIntegration(true);
  };

  const handleEmailIntegrationComplete = () => {
    setShowEmailIntegration(false);
    setShowEmailParsing(true);
  };

  const handleEmailParsingComplete = async (accounts: Account[]) => {
    try {
      setShowEmailParsing(false);
      
      // Save all accounts using AccountService
      const savedAccounts = [];
      for (const account of accounts) {
        try {
          const savedAccount = await AccountService.addAccount(account);
          savedAccounts.push(savedAccount);
        } catch (error) {
          console.error('Error saving account:', account.name, error);
        }
      }
      
      Alert.alert(
        t('add.alerts.importSuccess'),
        t('add.alerts.importSuccessMessage', { count: savedAccounts.length }),
        [{ text: t('add.alerts.ok') }]
      );
    } catch (error) {
      console.error('Error importing accounts:', error);
      Alert.alert(
        t('add.alerts.error'),
        error instanceof Error ? error.message : t('add.alerts.unknownError'),
        [{ text: t('add.alerts.ok') }]
      );
    }
  };

  const handleManualAdd = async () => {
    try {
      // Basic validation
      if (!formData.name || !formData.email || !formData.secret) {
        Alert.alert(t('add.alerts.error'), t('add.alerts.errorMessage'));
        return;
      }
      
      // Type-specific validation
      if (formData.type === 'mOTP' && !formData.pin) {
        Alert.alert(t('add.alerts.error'), 'PIN is required for mOTP');
        return;
      }

      if (formData.type === 'HOTP' && (!formData.counter || isNaN(parseInt(formData.counter)))) {
        Alert.alert(t('add.alerts.error'), 'Valid counter is required for HOTP');
        return;
      }

      // Validate secret format
      if (!OTPService.validateSecret(formData.secret)) {
        Alert.alert(t('add.alerts.error'), 'Invalid secret key format');
        return;
      }

      // Validate digits
      const digits = parseInt(formData.digits);
      if (isNaN(digits) || digits < 4 || digits > 8) {
        Alert.alert(t('add.alerts.error'), 'Digits must be between 4 and 8');
        return;
      }

      // Validate period for TOTP
      if (formData.type === 'TOTP') {
        const period = parseInt(formData.period);
        if (isNaN(period) || period < 1 || period > 300) {
          Alert.alert(t('add.alerts.error'), 'Period must be between 1 and 300 seconds');
          return;
        }
      }
      
      // Create account object
      const newAccount = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        secret: formData.secret.trim(),
        type: formData.type,
        category: formData.category,
        algorithm: formData.algorithm,
        digits: parseInt(formData.digits),
        period: formData.type === 'TOTP' ? parseInt(formData.period) : undefined,
        counter: formData.type === 'HOTP' ? parseInt(formData.counter) : undefined,
        pin: formData.type === 'mOTP' ? formData.pin : undefined,
      };

      // Save the account using AccountService
      const savedAccount = await AccountService.addAccount(newAccount);
      
      Alert.alert(
        t('add.alerts.addSuccess'),
        t('add.alerts.addSuccessMessage', { name: savedAccount.name }),
        [
          {
            text: t('add.alerts.ok'),
            onPress: () => {
              // Reset form
              setFormData({
                name: '',
                email: '',
                secret: '',
                type: 'TOTP',
                category: 'Other',
                pin: '',
                counter: '0',
                algorithm: 'SHA1',
                digits: '6',
                period: '30',
              });
              setShowManualForm(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error adding account:', error);
      Alert.alert(
        t('add.alerts.error'),
        error instanceof Error ? error.message : t('add.alerts.unknownError'),
        [{ text: t('add.alerts.ok') }]
      );
    }
  };

  if (showManualForm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowManualForm(false)}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('add.manual.title')}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.formContainer}>
          {/* Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('add.manual.type')}
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, { 
                backgroundColor: colors.surface,
                borderColor: colors.border
              }]}
              onPress={() => {
                // TODO: Implement dropdown selection
                const types: AuthType[] = ['TOTP', 'HOTP', 'mOTP', 'Steam'];
                const currentIndex = types.indexOf(formData.type);
                const nextIndex = (currentIndex + 1) % types.length;
                setFormData({ ...formData, type: types[nextIndex] });
              }}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {t(`add.manual.typeOptions.${formData.type}`)}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Service Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('add.manual.serviceName')}
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder={t('add.manual.serviceNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Account Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('add.manual.accountEmail')}
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder={t('add.manual.accountEmailPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Secret Key */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('add.manual.secretKey')}
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
              value={formData.secret}
              onChangeText={(text) => setFormData({ ...formData, secret: text })}
              placeholder={t('add.manual.secretKeyPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              secureTextEntry
            />
          </View>

          {/* mOTP PIN Field */}
          {formData.type === 'mOTP' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('add.manual.pin')}
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border
                }]}
                value={formData.pin}
                onChangeText={(text) => setFormData({ ...formData, pin: text })}
                placeholder={t('add.manual.pinPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                maxLength={4}
              />
            </View>
          )}

          {/* HOTP Counter Field */}
          {formData.type === 'HOTP' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('add.manual.counter')}
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border
                }]}
                value={formData.counter}
                onChangeText={(text) => setFormData({ ...formData, counter: text })}
                placeholder={t('add.manual.counterPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Advanced Options Toggle */}
          {(formData.type === 'TOTP' || formData.type === 'HOTP') && (
            <TouchableOpacity
              style={[styles.advancedToggle, { borderColor: colors.border }]}
              onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <Text style={[styles.advancedToggleText, { color: colors.text }]}>
                {t('add.manual.advancedOptions')}
              </Text>
              <ChevronDown 
                size={20} 
                color={colors.textSecondary}
                style={showAdvancedOptions ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </TouchableOpacity>
          )}

          {/* Advanced Options */}
          {showAdvancedOptions && (formData.type === 'TOTP' || formData.type === 'HOTP') && (
            <View style={styles.advancedOptions}>
              {/* Algorithm Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {t('add.manual.algorithm')}
                </Text>
                <TouchableOpacity
                  style={[styles.dropdown, { 
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }]}
                  onPress={() => {
                    const algorithms: ('SHA1' | 'SHA256' | 'SHA512')[] = ['SHA1', 'SHA256', 'SHA512'];
                    const currentIndex = algorithms.indexOf(formData.algorithm);
                    const nextIndex = (currentIndex + 1) % algorithms.length;
                    setFormData({ ...formData, algorithm: algorithms[nextIndex] });
                  }}
                >
                  <Text style={[styles.dropdownText, { color: colors.text }]}>
                    {t(`add.manual.algorithmOptions.${formData.algorithm}`)}
                  </Text>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Digits */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {t('add.manual.digits')}
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: colors.border
                    }]}
                    value={formData.digits}
                    onChangeText={(text) => setFormData({ ...formData, digits: text })}
                    keyboardType="numeric"
                    maxLength={1}
                  />
                </View>

                {/* Period (TOTP only) */}
                {formData.type === 'TOTP' && (
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      {t('add.manual.period')}
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: colors.surface,
                        color: colors.text,
                        borderColor: colors.border
                      }]}
                      value={formData.period}
                      onChangeText={(text) => setFormData({ ...formData, period: text })}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleManualAdd}
          >
            <Check size={20} color={colors.background} />
            <Text style={[styles.addButtonText, { color: colors.background }]}>
              {t('add.manual.addButton')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.placeholder} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('add.title')}
          </Text>
          <View style={styles.placeholder} />
        </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.mainIcon, { backgroundColor: colors.primary }]}>
            <Shield size={48} color={colors.background} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {t('add.subtitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('add.description')}
        </Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, { 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }]}
            onPress={handleQRScan}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.primary }]}>
              <QrCode size={24} color={colors.background} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t('add.scanQR.title')}
              </Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                {t('add.scanQR.description')}
              </Text>
            </View>
            <Camera size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }]}
            onPress={handleEmailImport}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.primary }]}>
              <Mail size={24} color={colors.background} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t('add.emailImport.title')}
              </Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                {t('add.emailImport.description')}
              </Text>
            </View>
            <Plus size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }]}
            onPress={() => setShowManualForm(true)}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.primary }]}>
              <Type size={24} color={colors.background} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t('add.manualInput.title')}
              </Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                {t('add.manualInput.description')}
              </Text>
            </View>
            <Plus size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      </SafeAreaView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <QRScanner
          onScan={handleQRScanResult}
          onClose={handleQRScanClose}
        />
      </Modal>

      {/* Email Input Modal */}
      <Modal
        visible={showEmailInput}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <EmailInputScreen
          onBack={() => setShowEmailInput(false)}
          onContinue={handleEmailInputContinue}
        />
      </Modal>

      {/* Email Integration Modal */}
      <Modal
        visible={showEmailIntegration}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <EmailIntegrationScreen
          onBack={() => setShowEmailIntegration(false)}
          onGrantAccess={handleEmailIntegrationComplete}
          emailConfig={emailConfig}
        />
      </Modal>

      {/* Email Parsing Modal */}
      <Modal
        visible={showEmailParsing}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <EmailParsingScreen
          onBack={() => setShowEmailParsing(false)}
          onActivate2FA={handleEmailParsingComplete}
          userEmail={userEmail}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  mainIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  advancedToggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedOptions: {
    marginBottom: 20,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
}); 