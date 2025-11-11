// Example tenant UI script for Customer_Form_v1
// This script runs on FormLoad and sets a default value, then blocks submission if email missing.

export default async function(ui: any, workflow: any, repo: any, context: any) {
  // set default country if empty
  const country = ui.getField('country');
  if (!country) {
    ui.setField('country', 'US');
  }

  // on before submit hook
  if (context.event === 'BeforeSubmit') {
    const email = ui.getField('email');
    if (!email) {
      ui.toast('Email is required');
      ui.blockSubmit(true);
    }
  }
}
