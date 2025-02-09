import {Component, OnInit, ViewContainerRef, OnDestroy} from '@angular/core';
import {QueuesService} from './queues.service';
import {AppService} from '../../app.service';
import {ConfirmComponent} from '../../widgets/dialogs/confirm/confirm.component';
import { MatDialogRef, MatDialog, MatDialogConfig } from '@angular/material/dialog';
import * as _ from 'lodash-es';
import {WindowRefService} from "../../helpers/window-ref.service";
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import {J4careHttpService} from "../../helpers/j4care-http.service";
import {LoadingBarService} from "@ngx-loading-bar/core";
import {ActivatedRoute} from "@angular/router";
import {j4care} from "../../helpers/j4care.service";
import {forkJoin, ReplaySubject} from "rxjs";
import {DevicesService} from "../../configuration/devices/devices.service";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";
import {Globalvar} from "../../constants/globalvar";
import {AeListService} from "../../configuration/ae-list/ae-list.service";
import {map} from "rxjs/operators";
import {PermissionService} from "../../helpers/permissions/permission.service";


@Component({
  selector: 'app-queues',
  templateUrl: './queues.component.html'
})
export class QueuesComponent implements OnInit, OnDestroy{
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    matches = [];
    queues = [];
    dialogRef: MatDialogRef<any>;
    _ = _;
    devices;
    localAETs;
    remoteAETs;
    counText = $localize `:@@COUNT:COUNT`;
    allAction;
    allActionsOptions = [
        {
            value:"cancel",
            label:$localize `:@@cancel_all_matching_tasks:Cancel all matching tasks`
        },{
            value:"reschedule",
            label:$localize `:@@reschedule_all_matching_tasks:Reschedule all matching tasks`
        },{
            value:"delete",
            label:$localize `:@@delete_all_matching_tasks:Delete all matching tasks`
        }
    ];
    allActionsActive = [];
    urlParam;
    statusValues = {};
    refreshInterval;
    interval = 10;
    Object = Object;
    tableHovered = false;
    statuses = [
        "SCHEDULED",
        "IN PROCESS",
        "COMPLETED",
        "WARNING",
        "FAILED",
        "CANCELED"
    ];
    timer = {
        started:false,
        startText:$localize `:@@start_auto_refresh:Start Auto Refresh`,
        stopText:$localize `:@@stop_auto_refresh:Stop Auto Refresh`
    };
    filterObject = {
        status:undefined,
        orderby:undefined,
        queueName:undefined,
        dicomDeviceName:undefined,
        createdTime:undefined,
        updatedTime:undefined,
        batchID:undefined,
        localAET:undefined,
        remoteAET:undefined,
        limit:20
    };
    filterSchema = [];
    constructor(
        public $http:J4careHttpService,
        public service: QueuesService,
        public mainservice: AppService,
        public cfpLoadingBar: LoadingBarService,
        public viewContainerRef: ViewContainerRef,
        public dialog: MatDialog,
        public config: MatDialogConfig,
        private httpErrorHandler:HttpErrorHandler,
        private route: ActivatedRoute,
        private deviceService:DevicesService,
        public aeListService:AeListService,
        private permissionService:PermissionService,
    ) {};
    ngOnInit(){
        this.initCheck(10);
    }
    initCheck(retries){
        let $this = this;
        if((KeycloakService.keycloakAuth && KeycloakService.keycloakAuth.authenticated) || (_.hasIn(this.mainservice,"global.notSecure") && this.mainservice.global.notSecure)){
            this.route.queryParams.subscribe(params => {
                this.urlParam = Object.assign({},params);
                if(this.urlParam["queueName"])
                    this.filterObject.queueName = this.urlParam["queueName"];
                if(this.urlParam["dicomDeviceName"])
                    this.filterObject.dicomDeviceName = this.urlParam["dicomDeviceName"];
                this.init();
            });
        }else{
            if (retries){
                setTimeout(()=>{
                    $this.initCheck(retries-1);
                },20);
            }else{
                this.route.queryParams.subscribe(params => {
                    this.urlParam = Object.assign({},params);
                    if(this.urlParam["queueName"])
                        this.filterObject.queueName = this.urlParam["queueName"];
                    this.init();
                });
                this.init();
            }
        }
        this.statusChange();
    }
    statusChange(){
/*        this.allActionsActive = this.allActionsOptions.filter((o)=>{
            if(this.filterObject.status == "SCHEDULED" || this.filterObject.status == $localize `:@@in_process:IN PROCESS`){
                return o.value != 'reschedule';
            }else{
                if(this.filterObject.status === '*')
                    return o.value != 'cancel' && o.value != 'reschedule';
                else
                    return o.value != 'cancel';
            }
        });*/
    }
    allActionChanged(e){
        let text = $localize `:@@matching_task_question:Are you sure, you want to ${Globalvar.getActionText(this.allAction)} all matching tasks?`;
        let filter = {
            dicomDeviceName:(this.filterObject.dicomDeviceName && this.filterObject.status != '*') ? this.filterObject.dicomDeviceName : undefined,
            status:(this.filterObject.status && this.filterObject.status != '*') ? this.filterObject.status : undefined,
            createdTime:this.filterObject.createdTime || undefined,
            updatedTime:this.filterObject.updatedTime || undefined,
            localAET:(this.filterObject.localAET && this.filterObject.localAET != '*') ? this.filterObject.localAET: undefined,
            remoteAET:(this.filterObject.remoteAET && this.filterObject.remoteAET != '*') ?  this.filterObject.remoteAET : undefined
        };
        switch (this.allAction){
            case "cancel":
                this.confirm({
                    content: text
                }).subscribe((ok)=>{
                    if(ok){
                        this.cfpLoadingBar.start();
                        this.service.cancelAll(filter,this.filterObject.queueName).subscribe((res)=>{
                            this.mainservice.showMsg($localize `:@@tasks_queue_canceled:${res.count} tasks in queue canceled successfully!`)
                            this.cfpLoadingBar.complete();
                        }, (err) => {
                            this.cfpLoadingBar.complete();
                            this.httpErrorHandler.handleError(err);
                        });
                    }
                    this.allAction = "";
                    this.allAction = undefined;
                });
            break;
            case "reschedule":
                this.confirm({
                    content: text
                }).subscribe((ok)=>{
                    if(ok){
                        this.deviceService.selectParametersForMatching((res)=>{
                            if(res){
                                this.cfpLoadingBar.start();
                                if(_.hasIn(res, "schema_model.newDeviceName") && res.schema_model.newDeviceName != ""){
                                    filter["newDeviceName"] = res.schema_model.newDeviceName;
                                }
                                if(_.hasIn(res, "schema_model.scheduledTime") && res.schema_model.scheduledTime != ""){
                                    filter["scheduledTime"] = res.schema_model.scheduledTime;
                                }
                                this.service.rescheduleAll(filter,this.filterObject.queueName).subscribe((res)=>{
                                    this.mainservice.showMsg($localize `:@@tasks_queue_rescheduled:${res.count} tasks in queue rescheduled successfully!`);
                                    this.cfpLoadingBar.complete();
                                }, (err) => {
                                    this.cfpLoadingBar.complete();
                                    this.httpErrorHandler.handleError(err);
                                });
                            }
                        },
                        this.devices);
                    }
                    this.allAction = "";
                    this.allAction = undefined;
                });
            break;
            case "delete":
                this.confirm({
                    content: text
                }).subscribe((ok)=>{
                    if(ok){
                        this.cfpLoadingBar.start();
                        this.service.deleteAll(filter,this.filterObject.queueName).subscribe((res)=>{
                            this.mainservice.showMsg($localize `:@@tasks_queue_deleted:${res.deleted} tasks in queue deleted successfully!`);
                            this.cfpLoadingBar.complete();
                        }, (err) => {
                            this.cfpLoadingBar.complete();
                            this.httpErrorHandler.handleError(err);
                        });
                    }
                    this.allAction = "";
                    this.allAction = undefined;
                });
            break;
        }
    }
    test(){
        this.deviceService.selectParameters((res)=>{
            console.log("j4carehelper select deviceres",res);
            if(res){

            }
        },
        this.devices.map(device=>{
            return {
                text:device.dicomDeviceName,
                value:device.dicomDeviceName
            }
        }));
    }
    init(){
        this.initQuery();
        this.statuses.forEach(status =>{
            this.statusValues[status] = {
                count: 0,
                loader: false
            };
        });
    }
    toggleAutoRefresh(){
        this.timer.started = !this.timer.started;
        if(this.timer.started){
            this.getCounts();
            this.refreshInterval = setInterval(()=>{
                this.getCounts();
            },this.interval*1000);
        }else
            clearInterval(this.refreshInterval);
    }
    tableMousEnter(){
        this.tableHovered = true;
    }
    tableMousLeave(){
        this.tableHovered = false;
    }
    getCounts(){
        if(this.filterObject.queueName){
            if(!this.tableHovered)
                this.search(0);
            Object.keys(this.statusValues).forEach(status=>{
                this.statusValues[status].loader = true;
                this.service.getCount(this.filterObject.queueName,
                    status,
                    undefined,
                    undefined,
                    this.filterObject.dicomDeviceName,
                    this.filterObject.createdTime,
                    this.filterObject.updatedTime,
                    this.filterObject.batchID,
                    this.filterObject.localAET,
                    this.filterObject.remoteAET,
                    '').subscribe((count)=>{
                    this.statusValues[status].loader = false;
                    try{
                        this.statusValues[status].count = count.count;
                    }catch (e){
                        this.statusValues[status].count = "";
                    }
                },(err)=>{
                    this.statusValues[status].loader = false;
                    this.statusValues[status].count = "!";
                });
            });
        }else{
            this.mainservice.showError($localize `:@@no_queue_name:No Queue Name selected!`);
        }
    }
    filterKeyUp(e){
        let code = (e.keyCode ? e.keyCode : e.which);
        if (code === 13){
            this.search(0);
        }
    };
    onSubmit(object){
        if(_.hasIn(object,"id") && _.hasIn(object,"model")){
            this.filterObject = object.model;
            if(object.id === "count"){
                this.getCount();
            }else{
                this.getCounts();
            }
        }
    }
    search(offset) {
        let $this = this;
        if(this.filterObject.queueName){
            $this.cfpLoadingBar.start();
            this.service.search(this.filterObject.queueName,
                this.filterObject.status, offset,
                this.filterObject.limit,
                this.filterObject.dicomDeviceName,
                this.filterObject.createdTime,
                this.filterObject.updatedTime,
                this.filterObject.batchID,
                this.filterObject.localAET,
                this.filterObject.remoteAET,
                this.filterObject.orderby)
                .subscribe((res) => {
                    if (res && res.length > 0){
                        $this.matches = res.map((properties, index) => {
                            $this.cfpLoadingBar.complete();
                            return {
                                offset: offset + index,
                                properties: properties,
                                showProperties: false
                            };
                        });
                    }else{
                        $this.matches = [];
                        $this.cfpLoadingBar.complete();
                        this.mainservice.showMsg($localize `:@@no_tasks_found:No tasks found!`)
                    }
                }, (err) => {
                    console.log('err', err);
                    $this.matches = [];
                });
        }else{
            this.mainservice.showError($localize `:@@no_queue_name:No Queue Name selected!`);
        }
    }
    getCount(){
        if(this.filterObject.queueName){
            this.cfpLoadingBar.start();
            this.setFilters();
            this.service.getCount(this.filterObject.queueName,
                this.filterObject.status,
                undefined,
                undefined,
                this.filterObject.dicomDeviceName,
                this.filterObject.createdTime,
                this.filterObject.updatedTime,
                this.filterObject.batchID,
                this.filterObject.localAET,
                this.filterObject.remoteAET, '').subscribe((count)=>{
                try{
                    this.counText = $localize `:@@count_param:COUNT ${count.count}:@@count:`;
                }catch (e){
                    this.counText = $localize `:@@COUNT:COUNT`;
                }
                this.cfpLoadingBar.complete();
            },(err)=>{
                this.cfpLoadingBar.complete();
                this.httpErrorHandler.handleError(err);
            });
        }else{
            this.mainservice.showError($localize `:@@no_queue_name:No Queue Name selected!`);
        }
    }
    confirm(confirmparameters){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(ConfirmComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.parameters = confirmparameters;
        return this.dialogRef.afterClosed();
    };
    cancel(match) {
        let $this = this;
        $this.cfpLoadingBar.start();
        this.service.cancel(this.filterObject.queueName, match.properties.taskID)
            .subscribe(function (res) {
                match.properties.status = 'CANCELED';
                $this.cfpLoadingBar.complete();
            }, (err) => {
                $this.cfpLoadingBar.complete();
                $this.httpErrorHandler.handleError(err);
            });
    };
    reschedule(match) {
        let $this = this;
        this.deviceService.selectParameters((res)=>{
                if(res){
                    $this.cfpLoadingBar.start();
                    let filter = {};
                    if(_.hasIn(res, "schema_model.newDeviceName") && res.schema_model.newDeviceName != ""){
                        filter["newDeviceName"] = res.schema_model.newDeviceName;
                    }
                    if(_.hasIn(res, "schema_model.scheduledTime") && res.schema_model.scheduledTime != ""){
                        filter["scheduledTime"] = res.schema_model.scheduledTime;
                    }
                    this.service.reschedule(this.filterObject.queueName, match.properties.taskID, filter)
                        .subscribe((res) => {
                            $this.search(0);
                            $this.cfpLoadingBar.complete();
                        }, (err) => {
                            $this.cfpLoadingBar.complete();
                            $this.httpErrorHandler.handleError(err);
                        });
                }
            },
            this.devices);
    };
    checkAll(event){
        console.log("in checkall",event.target.checked);
        this.matches.forEach((match)=>{
            match.checked = event.target.checked;
        });
    }
    delete(match) {
        let $this = this;
        this.confirm({
            content: $localize `:@@want_to_delete_question:Are you sure you want to delete?`
        }).subscribe(result => {
            if (result){
                $this.cfpLoadingBar.start();

                this.service.delete(this.filterObject.queueName, match.properties.taskID)
                .subscribe((res) => {
                    $this.search($this.matches[0].offset);
                    $this.cfpLoadingBar.complete();
                },(err)=>{
                    $this.cfpLoadingBar.complete();
                    $this.httpErrorHandler.handleError(err);
                });
            }
        }, (err) => {
            $this.cfpLoadingBar.complete();
            $this.httpErrorHandler.handleError(err);
        });
    };
    executeAll(mode){
        this.confirm({
            content: $localize `:@@action_selected_entries_question:Are you sure you want to ${Globalvar.getActionText(mode)} selected entries?`
        }).subscribe(result => {
            if (result){
                this.cfpLoadingBar.start();
                this.matches.forEach((match)=>{
                    if(match.checked){
                        this.service[mode](this.filterObject.queueName, match.properties.taskID)
                            .subscribe((res) => {
                            },(err)=>{
                                this.httpErrorHandler.handleError(err);
                            });
                    }
                });
                setTimeout(()=>{
                    if(mode === "delete"){
                        this.search(this.matches[0].offset||0);
                    }else{
                        this.search(0);
                    }
                    this.cfpLoadingBar.complete();
                },300);
            }
        });
    }
    getQueueDescriptionFromName(queuename){
        let description;
        _.forEach(this.queues, (m, i) => {
            if (m.name == queuename){
                description = m.description;
            }
        });
        return description;
    };
    hasOlder(objs) {
        return objs && (objs.length === this.filterObject.limit);
    };
    hasNewer(objs) {
        return objs && objs.length && objs[0].offset;
    };
    newerOffset(objs) {
        return Math.max(0, objs[0].offset - this.filterObject.limit);
    };
    olderOffset(objs) {
        return objs[0].offset + this.filterObject.limit;
    };
    initQuery() {
        let $this = this;
        this.cfpLoadingBar.start();
        this.getLocalAEs();
        this.getRemoteAEs();
        this.$http.get(`${j4care.addLastSlash(this.mainservice.baseUrl)}queue`)
            // .map(res => {let resjson; try{ let pattern = new RegExp("[^:]*:\/\/[^\/]*\/auth\/"); if(pattern.exec(res.url)){ WindowRefService.nativeWindow.location = "/dcm4chee-arc/ui2/";} resjson = res; }catch (e){ resjson = [];} return resjson;})
            .subscribe((res) => {
                $this.getDevices();
                $this.queues = res;
                if(!this.urlParam && !this.filterObject.queueName)
                    this.filterObject.queueName = res[0].name;
                $this.cfpLoadingBar.complete();
            });
    }
    setFilters(){
        this.filterSchema = j4care.prepareFlatFilterObject(this.service.getFilterSchema(this.queues,this.devices,this.localAETs,this.remoteAETs,this.counText),3);
        if(this.urlParam) {
            this.filterObject["queueName"] = 'Export1';
            this.filterObject["orderby"] = '-updatedTime';
        }
    }
    getDevices(){
        this.cfpLoadingBar.start();
        this.service.getDevices().subscribe(devices=>{
            this.cfpLoadingBar.complete();
            this.devices = devices.filter(dev => dev.hasArcDevExt);
            this.setFilters();
            if(this.urlParam && Object.keys(this.urlParam).length > 0)
                this.search(0);
        },(err)=>{
            this.cfpLoadingBar.complete();
            console.error("Could not get devices",err);
        });
    }
    getRemoteAEs(){
        this.aeListService.getAes()
            .subscribe((response)=>{
            this.remoteAETs = response;
        });
    }
    getLocalAEs(){
        this.aeListService.getAets()
            .subscribe((response)=>{
                this.localAETs = response;
            });
    }
    ngOnDestroy(){
        if(this.timer.started){
            this.timer.started = false;
            clearInterval(this.refreshInterval);
        }
        this.destroyed$.next(true);
        this.destroyed$.complete();
    }
}
