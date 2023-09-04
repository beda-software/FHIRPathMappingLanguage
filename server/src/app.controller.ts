import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { Resource } from 'fhir/r4b';


class Template {
    context: Record<string,Resource> | Resource;
    template: object;
}


function containsQuestionnaireResponse(context: Template['context']): context is Record<string,Resource> {
    return Object.keys(context).includes('QuestionnaireResponse');
}

@Controller('parse-template')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Post()
    @HttpCode(200)
    resolveTemplate(@Body() body: Template): object {
        const {context, template} = body;
        if (containsQuestionnaireResponse(context)){
            return this.appService.resolveTemplate(context.QuestionnaireResponse, template);
        } else {
            return this.appService.resolveTemplate(context, template);
        }

    }
}
