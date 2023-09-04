import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { Resource } from 'fhir/r4b';


class Template {
    context: Resource;
    template: object;
}

@Controller('parse-template')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Post()
    @HttpCode(200)
    resolveTemplate(@Body() body: Template): object {
        const {context, template} = body;
        return this.appService.resolveTemplate(context, template);
    }
}
