/**
 * middleware/audit_logger.js
 * Asynchronous Structured Audit Logging Helper
 */

const { stmts } = require('../database/db');

async function auditLog({ table, recordId, action, oldVals = null, newVals = null, req = null }) {
  try {
    const performedBy = req?.user?.username || 'system';
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
    const ua = req?.headers?.['user-agent'] || 'System Process';

    await stmts.insertAudit.run({
      table_name: table,
      record_id: String(recordId),
      action: action,
      old_values: oldVals,
      new_values: newVals,
      performed_by: performedBy,
      ip_address: ip,
      user_agent: ua
    });
  } catch (err) {
    console.warn('[AUDIT ERROR]', err.message);
  }
}

module.exports = {
  auditLog
};
