export function homeActionsForSession(session) {
  if (session?.user?.id) {
    return {
      addItem: { href: 'create.html', label: 'Add an item' },
      settings: { href: 'settings.html', label: 'Settings' },
    };
  }
  return {
    addItem: { href: 'login.html?next=create.html', label: 'Log in to add an item' },
    settings: { href: 'login.html?next=settings.html', label: 'Log in for settings' },
  };
}
