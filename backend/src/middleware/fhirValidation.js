'use strict';

/**
 * FHIR Validation Middleware
 * Validates accept headers and mandatory FHIR R4 request schema structures.
 */

function validateFHIRHeaders(req, res, next) {
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('application/fhir+json') || acceptHeader.includes('application/json') || acceptHeader === '*/*') {
    res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
    return next();
  }
  return res.status(406).json({
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'not-supported',
        details: { text: 'Accept header must accept application/fhir+json or application/json' }
      }
    ]
  });
}

function validateFHIRResource(req, res, next) {
  if (['POST', 'PUT'].includes(req.method)) {
    const resource = req.body;
    if (!resource || !resource.resourceType) {
      return res.status(422).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'structure',
            details: { text: 'Missing required field: resourceType' }
          }
        ]
      });
    }
  }
  next();
}

module.exports = {
  validateFHIRHeaders,
  validateFHIRResource
};
