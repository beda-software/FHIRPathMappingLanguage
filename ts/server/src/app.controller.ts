import { Controller, Post, Body, HttpCode, UseFilters } from '@nestjs/common';
import { AppService } from './app.service';
import { Resource } from 'fhir/r4b';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
import * as fhirpath from 'fhirpath';
import { FPMLValidationErrorFilter } from './app.filters';
class Template {
    context: Record<string, Resource> | Resource;
    template: object;
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
        const { context, template } = body;

        if (containsQuestionnaireResponse(context)) {
            return this.appService.resolveTemplate(
                context.QuestionnaireResponse,
                template,
                context,
                fhirpath_r4_model,
                {
                    userInvocationTable: {
                        answers: {
                            fn: (inputs, linkId: string) => {
                                return fhirpath.evaluate(
                                    inputs,
                                    `repeat(item).where(linkId='${linkId}').answer.value`,
                                    null,
                                    fhirpath_r4_model,
                                );
                            },
                            arity: { 0: [], 1: ['String'] },
                        },
                    },
                },
            );
        }

        return this.appService.resolveTemplate(context, template, context, fhirpath_r4_model);
    }

    @Post('aidbox/parse-template')
    @HttpCode(200)
    resolveTemplateAidbox(@Body() body: Template): object {
        const { context, template } = body;

        if (containsQuestionnaireResponse(context)) {
            return this.appService.resolveTemplate(
                context.QuestionnaireResponse,
                template,
                context,
                null,
                {
                    userInvocationTable: {
                        answers: {
                            fn: (inputs, linkId: string) => {
                                return fhirpath.evaluate(
                                    inputs,
                                    `repeat(item).where(linkId='${linkId}').answer.value.children()`,
                                    null,
                                );
                            },
                            arity: { 0: [], 1: ['String'] },
                        },
                    },
                },
            );
        }

        return this.appService.resolveTemplate(context, template, context);
    }
}
