import { Controller, Post, Body, HttpCode, UseFilters } from '@nestjs/common';
import { AppService } from './app.service';
import { Resource } from 'fhir/r4b';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
import { FPMLValidationErrorFilter } from './app.filters';
class Template {
    context: Record<string, Resource> | Resource;
    template: object;
    strict?: boolean;
}

function containsQuestionnaireResponse(
    context: Template['context'],
): context is Record<string, Resource> {
    return Object.keys(context).includes('QuestionnaireResponse');
}

@Controller()
@UseFilters(FPMLValidationErrorFilter)
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Post(['parse-template', 'r4/parse-template'])
    @HttpCode(200)
    resolveTemplateR4(@Body() body: Template): object {
        const { context, template, strict = false } = body;

        return this.appService.resolveTemplate(
            containsQuestionnaireResponse(context) ? context.QuestionnaireResponse : context,
            template,
            context,
            fhirpath_r4_model,
            strict,
        );
    }

    @Post('aidbox/parse-template')
    @HttpCode(200)
    resolveTemplateAidbox(@Body() body: Template): object {
        const { context, template, strict = false } = body;

        return this.appService.resolveTemplate(
            containsQuestionnaireResponse(context) ? context.QuestionnaireResponse : context,
            template,
            context,
            null,
            strict,
        );
    }
}
