import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import * as service from "./contactSubmissions.service";

export const listContactSubmissions = asyncHandler(
  async (req: Request, res: Response) => {
    const submissions = await service.listContactSubmissions(req.query);

    return ApiResponse.paginated(
      res,
      "Contact submissions fetched successfully.",
      submissions.data,
      submissions.pagination,
    );
  },
);
export const getContactSubmission = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const submission = await service.getContactSubmission(req.params.id);

    return ApiResponse.success(
      res,
      "Contact submission fetched successfully.",
      submission,
    );
  },
);
