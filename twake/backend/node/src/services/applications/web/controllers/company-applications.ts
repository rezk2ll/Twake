import { FastifyReply, FastifyRequest } from "fastify";

import {
  PaginationQueryParameters,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
  ResourceUpdateResponse,
} from "../../../../utils/types";
import Application, { PublicApplicationObject } from "../../entities/application";
import { RealtimeServiceAPI } from "../../../../core/platform/services/realtime/api";
import { CompanyExecutionContext } from "../types";
import { ApplicationServiceAPI } from "../../api";
import { CrudController } from "../../../../core/platform/services/webserver/types";
import { getCompanyApplicationRooms } from "../../realtime";

export class CompanyApplicationController
  implements
    CrudController<
      ResourceGetResponse<PublicApplicationObject>,
      ResourceUpdateResponse<PublicApplicationObject>,
      ResourceListResponse<PublicApplicationObject>,
      ResourceDeleteResponse
    >
{
  constructor(protected realtime: RealtimeServiceAPI, protected service: ApplicationServiceAPI) {}

  async get(
    request: FastifyRequest<{ Params: { company_id: string; application_id: string } }>,
  ): Promise<ResourceGetResponse<PublicApplicationObject>> {
    const context = getCompanyExecutionContext(request);
    const resource = await this.service.companyApplications.get(
      { application_id: request.params.application_id, company_id: context.company.id },
      context,
    );
    return {
      resource: resource?.application,
    };
  }

  async list(
    request: FastifyRequest<{
      Params: { company_id: string };
      Querystring: PaginationQueryParameters & { search: string };
    }>,
  ): Promise<ResourceListResponse<PublicApplicationObject>> {
    const context = getCompanyExecutionContext(request);
    const resources = await this.service.companyApplications.list(
      request.query,
      { search: request.query.search },
      context,
    );

    return {
      resources: resources.getEntities().map(ca => ca.application),
      next_page_token: resources.nextPage.page_token,
      websockets:
        this.realtime.sign(
          getCompanyApplicationRooms(request.params.company_id),
          context.user.id,
        ) || [],
    };
  }

  async save(
    request: FastifyRequest<{
      Params: { company_id: string; application_id: string };
      Body: PublicApplicationObject;
    }>,
  ): Promise<ResourceGetResponse<PublicApplicationObject>> {
    const context = getCompanyExecutionContext(request);
    const resource = await this.service.companyApplications.save(
      { application_id: request.params.application_id, company_id: context.company.id },
      {},
      context,
    );
    return {
      resource: resource.entity.application,
    };
  }

  async delete(
    request: FastifyRequest<{ Params: { company_id: string; application_id: string } }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getCompanyExecutionContext(request);
    const resource = await this.service.companyApplications.delete(
      { application_id: request.params.application_id, company_id: context.company.id },
      context,
    );
    return {
      status: resource.deleted ? "success" : "error",
    };
  }
}

function getCompanyExecutionContext(
  request: FastifyRequest<{
    Params: { company_id: string };
  }>,
): CompanyExecutionContext {
  return {
    user: request.currentUser,
    company: { id: request.params.company_id },
    url: request.url,
    method: request.routerMethod,
    reqId: request.id,
    transport: "http",
  };
}
