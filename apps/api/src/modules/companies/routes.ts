import {
  companiesResponse,
  companyDetailResponse,
  companyResponse,
  updateCompanyInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { getCompany, listCompanies, updateCompany } from '../../services/companies';

export const companyRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)
  .get('/', async (c) => {
    const companies = await listCompanies(c.env.DB, c.get('db'), c.get('workspaceId'));
    return c.json(companiesResponse.parse({ companies }));
  })
  .get('/:id', async (c) => {
    const detail = await getCompany(c.env.DB, c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(companyDetailResponse.parse(detail));
  })
  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateCompanyInput);
    const company = await updateCompany(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(companyResponse.parse({ company }));
  });
