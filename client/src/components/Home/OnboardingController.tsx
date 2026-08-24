import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { contacts, onboarding } from '../../services/api';
import ContactsModal from './ContactsModal';
import OnboardingModal from './OnboardingModal';

export default function OnboardingController() {
  const { user } = useAuth();
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [contactsCompleted, setContactsCompleted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = async () => {
      try {
        const [os, cs] = await Promise.all([onboarding.status(), contacts.syncStatus()]);
        if (cancelled) return;
        setOnboardingRequired(os.required);
        setContactsCompleted(cs.completed);
        if (os.required) {
          setShowOnboarding(!sessionStorage.getItem('wouaff_onboarding_dismissed'));
        } else if (!cs.completed) {
          setShowContacts(!sessionStorage.getItem('wouaff_contacts_dismissed'));
        }
      } catch {
        /* silencieux, on ne bloque jamais la page */
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleOnboardingDone = async () => {
    localStorage.setItem('wouaff_onboarding_done', '1');
    sessionStorage.removeItem('wouaff_onboarding_dismissed');
    setOnboardingRequired(false);
    setShowOnboarding(false);
    try {
      const cs = await contacts.syncStatus();
      setContactsCompleted(cs.completed);
      if (!cs.completed && !sessionStorage.getItem('wouaff_contacts_dismissed')) {
        setShowContacts(true);
      }
    } catch {
      /* silencieux */
    }
  };

  const handleOnboardingSkip = () => {
    sessionStorage.setItem('wouaff_onboarding_dismissed', '1');
    setShowOnboarding(false);
  };

  const handleContactsDone = () => {
    setContactsCompleted(true);
    setShowContacts(false);
  };

  const handleContactsClose = () => {
    sessionStorage.setItem('wouaff_contacts_dismissed', '1');
    setShowContacts(false);
  };

  return (
    <>
      {showOnboarding && onboardingRequired && (
        <OnboardingModal onDone={handleOnboardingDone} onSkip={handleOnboardingSkip} />
      )}
      {showContacts && !onboardingRequired && !contactsCompleted && (
        <ContactsModal onDone={handleContactsDone} onClose={handleContactsClose} />
      )}
    </>
  );
}
