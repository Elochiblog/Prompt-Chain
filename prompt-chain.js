  // simple heuristics rules to interpret intent
function interpretIntent(query) {
  
  const q = query.toLowerCase();
  if (!q || q.trim().length === 0) return 'No query provided.';

  const intents = [];
  if (q.includes('open') && (q.includes('account') || q.includes('new account') || q.includes('create'))) intents.push('Open account');
  if (q.includes('bill') || q.includes('charge') || q.includes('payment') || q.includes('overcharged') || q.includes('billing')) intents.push('Billing / charge concern');
  if (q.includes('login') || q.includes('sign in') || q.includes('can\'t access') || q.includes('forgot') || q.includes('password')) intents.push('Account access');
  if (q.includes('dispute') || (q.includes('$') && q.includes('charge')) || q.includes('unauthor')) intents.push('Investigate transaction');
  if (q.includes('card') || q.includes('credit card') || q.includes('debit')) intents.push('Card service request');
  if (q.includes('statement') || q.includes('transactions list') || q.includes('download statement')) intents.push('Account statement');
  if (q.includes('loan') || q.includes('mortgage') || q.includes('borrow')) intents.push('Loan inquiry');
  if (intents.length === 0) intents.push('General information / other');

  return intents.join('; ');
}

function mapToCategories(query) {
  const cats = [];
  const q = query.toLowerCase();
  if (q.match(/open|create|new account/)) cats.push('Account Opening');
  if (q.match(/bill|charge|payment|overcharg/)) cats.push('Billing Issue');
  if (q.match(/login|sign in|forgot|password|can't access|cannot access/)) cats.push('Account Access');
  if (q.match(/dispute|unauthor|charge|\$|transaction/)) cats.push('Transaction Inquiry');
  if (q.match(/card|credit card|debit card/)) cats.push('Card Services');
  if (q.match(/statement|download statement|transactions list|monthly statement/)) cats.push('Account Statement');
  if (q.match(/loan|mortgage|interest rate|apply for loan/)) cats.push('Loan Inquiry');
  if (cats.length === 0) cats.push('General Information');
  // return unique
  return Array.from(new Set(cats));
}

function chooseCategory(mapped) {
  // simple priority order
  const priority = ['Account Opening','Account Access','Transaction Inquiry','Card Services','Billing Issue','Account Statement','Loan Inquiry','General Information'];
  for (const p of priority) {
    if (mapped.includes(p)) return p;
  }
  return 'General Information';
}

function extractDetails(query, category) {
  const details = {};
  const q = query;
  // amounts
  const amountMatch = q.match(/\$\s?([0-9]+(?:\.[0-9]{1,2})?)/);
  if (amountMatch) details.amount = amountMatch[0];
  // dates US style
  const dateMatch = q.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12][0-9]|3[01])[\/-](?:\d{2}|\d{4})\b/);
  const altDateMatch = q.match(/\b(0?[1-9]|1[0-2])\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi);
  if (dateMatch) details.date = dateMatch[0];
  else if (altDateMatch) details.date = altDateMatch[0];
  // card type
  if (/credit card|visa|mastercard|amex|american express|debit card/i.test(q)) {
    const m = q.match(/(visa|mastercard|amex|american express|credit card|debit card)/i);
    details.card = m ? m[0] : 'unspecified';
  }
  // transaction id
  const txMatch = q.match(/txid[:#]?\s*([A-Za-z0-9-]+)/i);
  if (txMatch) details.transactionId = txMatch[1];
  // account last 4
  const last4 = q.match(/(\b\d{4}\b)/);
  if (last4) details.last4 = last4[0];
  // free text
  details.extracted_text = q;

  // suggest next required fields depending on category
  const needed = [];
  if (category === 'Transaction Inquiry' || category === 'Card Services' || category === 'Billing Issue') {
    if (!details.amount) needed.push('transaction amount');
    if (!details.date) needed.push('transaction date');
    if (!details.card) needed.push('card type or last 4 digits');
  }
  if (category === 'Account Access') {
    needed.push('username/email and error message');
  }
  if (category === 'Account Opening') {
    needed.push('identity documents and contact details');
  }
  if (needed.length > 0) details.missing = needed;

  return details;
}

function generateShortResponse(category, details) {
  switch (category) {
    case 'Transaction Inquiry':
      return `Sorry you're experiencing this. I can see a debit of ${details.amount || 'an amount'} on ${details.date || 'this date'}. Please confirm the last 4 digits of the card so I can investigate and file a dispute.`;
    case 'Card Services':
      return `I can assist with your card. Please confirm the card (e.g., Visa, Mastercard) and last 4 digits, and whether the card is lost or you need a replacement.`;
    case 'Account Access':
      return `Sorry you're having trouble signing in. Please provide your username/email and any error message you see. For security, do not share your full password.`;
    case 'Account Opening':
      return `Great — we can open a new account. I'll need your full name, date of birth, and a form of ID. Would you like to proceed?`;
    case 'Billing Issue':
      return `Thank you. I can help with billing queries. Please share the billed amount, date, and any transaction reference.`;
    case 'Account Statement':
      return `I can provide your account statement. For which period would you like it (e.g., last month, a date range)?`;
    case 'Loan Inquiry':
      return `I can help with loan information. What type of loan are you interested in and do you want rates or to apply?`;
    default:
      return `Thanks for reaching out. Could you provide a bit more detail so I can assist?`;
  }
}

function runPromptChain(query) {
  // Step 1. Interpret intent
  const intent = interpretIntent(query);

  // Step 2. Map to possible categories
  const mapped = mapToCategories(query);

  // Step 3. Choose best category
  const chosen = chooseCategory(mapped);

  // Step 4. Extract details
  const details = extractDetails(query, chosen);

  // Step 5. Generate short response
  const response = generateShortResponse(chosen, details);

  return [
    { step: 'Interpret intent', output: intent },
    { step: 'Map to possible categories', output: mapped },
    { step: 'Choose the most appropriate category', output: chosen },
    { step: 'Extract additional details', output: details },
    { step: 'Generate a short response', output: response }
  ];
}

